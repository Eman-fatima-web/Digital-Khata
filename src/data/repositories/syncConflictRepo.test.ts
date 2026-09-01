import { beforeEach, describe, expect, it } from 'vitest'

import type { Customer } from '../../core/types'
import { db } from '../../data/db/db'
import {
  getSyncConflicts,
  resolveSyncConflict,
  saveSyncConflict,
} from '../../data/repositories/syncConflictRepo'
import { getPendingActions } from '../../data/repositories/syncQueueRepo'
import { generateId } from '../../lib/utils'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? generateId(),
    userId: 'user-1',
    shopId: 'shop-1',
    name: 'Test Customer',
    phone: '03001234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    version: 1,
    ...overrides,
  }
}

describe('syncConflictRepo', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
    await db.syncQueue.clear()
    await db.syncConflicts.clear()
  })

  describe('saveSyncConflict', () => {
    it('stores a conflict record', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local Name' })
      const remote = makeCustomer({ id: 'c1', name: 'Remote Name', version: 2 })

      await db.customers.put(local)
      await saveSyncConflict('customers', local, remote)

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].table).toBe('customers')
      expect(conflicts[0].recordId).toBe('c1')
      expect((conflicts[0].local as Customer).name).toBe('Local Name')
      expect((conflicts[0].remote as Customer).name).toBe('Remote Name')
    })

    it('sets local record syncStatus to conflict', async () => {
      const local = makeCustomer({ id: 'c1', syncStatus: 'pending' })
      const remote = makeCustomer({ id: 'c1', version: 2 })

      await db.customers.put(local)
      await saveSyncConflict('customers', local, remote)

      const record = await db.customers.get('c1')
      expect(record?.syncStatus).toBe('conflict')
    })

    it('removes pending sync actions for the conflicted record', async () => {
      const local = makeCustomer({ id: 'c1' })
      const remote = makeCustomer({ id: 'c1', version: 2 })

      await db.customers.put(local)
      await db.syncQueue.add({
        id: 'action-1',
        table: 'customers',
        recordId: 'c1',
        operation: 'update',
        payload: local,
        createdAt: '2026-01-01T00:00:00.000Z',
        attempts: 0,
      })

      await saveSyncConflict('customers', local, remote)

      const pending = await getPendingActions()
      expect(pending).toHaveLength(0)
    })
  })

  describe('getSyncConflicts', () => {
    it('returns all conflicts ordered by createdAt descending', async () => {
      const local1 = makeCustomer({ id: 'c1' })
      const remote1 = makeCustomer({ id: 'c1', version: 2 })
      const local2 = makeCustomer({ id: 'c2' })
      const remote2 = makeCustomer({ id: 'c2', version: 2 })

      await db.customers.bulkPut([local1, local2])
      await saveSyncConflict('customers', local1, remote1)
      await saveSyncConflict('customers', local2, remote2)

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(2)
      expect(conflicts[0].createdAt >= conflicts[1].createdAt).toBe(true)
    })
  })

  describe('resolveSyncConflict', () => {
    it('with choice "local" increments version and creates pending sync action', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', version: 1 })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 3 })

      await db.customers.put(local)
      await saveSyncConflict('customers', local, remote)

      const conflicts = await getSyncConflicts()
      await resolveSyncConflict(conflicts[0], 'local')

      const record = await db.customers.get('c1')
      expect((record as Customer)?.name).toBe('Local')
      expect(record?.version).toBe(4)
      expect(record?.syncStatus).toBe('pending')

      const pending = await getPendingActions()
      expect(pending).toHaveLength(1)
      expect(pending[0].operation).toBe('update')
      expect((pending[0].payload as Customer).name).toBe('Local')
    })

    it('with choice "remote" stores remote version as synced', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', version: 1 })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 3 })

      await db.customers.put(local)
      await saveSyncConflict('customers', local, remote)

      const conflicts = await getSyncConflicts()
      await resolveSyncConflict(conflicts[0], 'remote')

      const record = await db.customers.get('c1')
      expect((record as Customer)?.name).toBe('Remote')
      expect(record?.version).toBe(3)
      expect(record?.syncStatus).toBe('synced')

      const pending = await getPendingActions()
      expect(pending).toHaveLength(0)
    })

    it('removes the conflict after resolution', async () => {
      const local = makeCustomer({ id: 'c1' })
      const remote = makeCustomer({ id: 'c1', version: 2 })

      await db.customers.put(local)
      await saveSyncConflict('customers', local, remote)

      let conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(1)

      await resolveSyncConflict(conflicts[0], 'local')

      conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(0)
    })
  })
})
