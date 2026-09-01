import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Customer } from '../../core/types'
import { db } from '../../data/db/db'
import type { CloudProvider } from '../../data/cloud/CloudProvider'
import { syncService } from '../../data/services/syncService'
import { enqueueSyncAction } from '../../data/repositories/syncQueueRepo'
import { getSyncConflicts } from '../../data/repositories/syncConflictRepo'
import { generateId } from '../../lib/utils'

vi.mock('../../data/services/networkService', () => ({
  networkService: {
    isOnline: vi.fn().mockReturnValue(true),
    subscribe: vi.fn(),
  },
  getLastSyncAt: vi.fn().mockReturnValue(undefined),
  setLastSyncAt: vi.fn(),
}))

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

function makeMockProvider(overrides: Partial<CloudProvider> = {}): CloudProvider {
  return {
    name: 'mock-provider',
    push: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
    pull: vi.fn().mockResolvedValue({ records: [] }),
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }
}

describe('syncService', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
    await db.syncQueue.clear()
    await db.syncConflicts.clear()
  })

  describe('applyPulledRecord', () => {
    it('ignores same local/remote record', async () => {
      const local = makeCustomer({ id: 'c1', version: 1, updatedAt: '2026-01-01T00:00:00.000Z' })
      const remote = makeCustomer({ id: 'c1', version: 1, updatedAt: '2026-01-01T00:00:00.000Z' })

      await db.customers.put(local)

      const provider = makeMockProvider({
        pull: vi.fn().mockResolvedValue({ records: [{ table: 'customers', record: remote }] }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const record = await db.customers.get('c1')
      expect((record as Customer)?.name).toBe('Test Customer')
      expect(record?.version).toBe(1)

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(0)
    })

    it('applies newer remote record when local has no unsynced changes', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', version: 1, syncStatus: 'synced' })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 2, updatedAt: '2026-01-02T00:00:00.000Z' })

      await db.customers.put(local)

      const provider = makeMockProvider({
        pull: vi.fn().mockResolvedValue({ records: [{ table: 'customers', record: remote }] }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const record = await db.customers.get('c1')
      expect((record as Customer)?.name).toBe('Remote')
      expect(record?.version).toBe(2)

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(0)
    })

    it('creates conflict when local has pending changes', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', version: 1, syncStatus: 'pending' })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 2 })

      await db.customers.put(local)

      const provider = makeMockProvider({
        pull: vi.fn().mockResolvedValue({ records: [{ table: 'customers', record: remote }] }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const record = await db.customers.get('c1')
      expect(record?.syncStatus).toBe('conflict')

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(1)
      expect((conflicts[0].local as Customer).name).toBe('Local')
      expect((conflicts[0].remote as Customer).name).toBe('Remote')
    })
  })

  describe('handlePushSuccess', () => {
    it('stores conflict returned from push for review', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', version: 1 })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 2 })

      await db.customers.put(local)
      await enqueueSyncAction('customers', 'c1', 'update', local)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({
          success: true,
          conflicts: [{ table: 'customers', recordId: 'c1', remote }],
        }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const conflicts = await getSyncConflicts()
      expect(conflicts).toHaveLength(1)
      expect((conflicts[0].local as Customer).name).toBe('Local')
      expect((conflicts[0].remote as Customer).name).toBe('Remote')
    })

    it('marks successful non-conflicting actions as synced', async () => {
      const customer1 = makeCustomer({ id: 'c1', name: 'Customer 1', syncStatus: 'pending' })
      const customer2 = makeCustomer({ id: 'c2', name: 'Customer 2', syncStatus: 'pending' })

      await db.customers.bulkPut([customer1, customer2])
      await enqueueSyncAction('customers', 'c1', 'update', customer1)
      await enqueueSyncAction('customers', 'c2', 'update', customer2)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const record1 = await db.customers.get('c1')
      const record2 = await db.customers.get('c2')
      expect(record1?.syncStatus).toBe('synced')
      expect(record2?.syncStatus).toBe('synced')

      const pending = await db.syncQueue.toArray()
      expect(pending).toHaveLength(0)
    })

    it('does not mark conflicting actions as synced', async () => {
      const local = makeCustomer({ id: 'c1', name: 'Local', syncStatus: 'pending' })
      const remote = makeCustomer({ id: 'c1', name: 'Remote', version: 2 })

      await db.customers.put(local)
      await enqueueSyncAction('customers', 'c1', 'update', local)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({
          success: true,
          conflicts: [{ table: 'customers', recordId: 'c1', remote }],
        }),
      })
      syncService.setProvider(provider)

      await syncService.sync()

      const pending = await db.syncQueue.toArray()
      expect(pending).toHaveLength(0)

      const record = await db.customers.get('c1')
      expect(record?.syncStatus).toBe('conflict')
    })
  })
})
