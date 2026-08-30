import { beforeEach, describe, expect, it } from 'vitest'

import type { Customer } from '../../core/types'
import { db } from '../../data/db/db'
import {
  enqueueSyncAction,
  getPendingActions,
  markActionFailed,
  markActionSucceeded,
  removeActionsForRecord,
} from '../../data/repositories/syncQueueRepo'
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
    syncStatus: 'pending',
    version: 1,
    ...overrides,
  }
}

describe('syncQueueRepo', () => {
  beforeEach(async () => {
    await db.syncQueue.clear()
  })

  describe('enqueueSyncAction', () => {
    it('creates a pending sync action', async () => {
      const customer = makeCustomer({ id: 'c1' })

      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const actions = await getPendingActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].table).toBe('customers')
      expect(actions[0].recordId).toBe('c1')
      expect(actions[0].operation).toBe('create')
      expect(actions[0].payload).toEqual(customer)
      expect(actions[0].attempts).toBe(0)
    })
  })

  describe('getPendingActions', () => {
    it('returns queued actions ordered by createdAt', async () => {
      const customer1 = makeCustomer({ id: 'c1' })
      const customer2 = makeCustomer({ id: 'c2' })

      await enqueueSyncAction('customers', 'c1', 'create', customer1)
      await enqueueSyncAction('customers', 'c2', 'create', customer2)

      const actions = await getPendingActions()
      expect(actions).toHaveLength(2)
      expect(actions[0].recordId).toBe('c1')
      expect(actions[1].recordId).toBe('c2')
    })
  })

  describe('markActionSucceeded', () => {
    it('removes the action from the queue', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      let actions = await getPendingActions()
      expect(actions).toHaveLength(1)

      await markActionSucceeded(actions[0].id)

      actions = await getPendingActions()
      expect(actions).toHaveLength(0)
    })
  })

  describe('markActionFailed', () => {
    it('increments attempts and stores error', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const actions = await getPendingActions()
      const actionId = actions[0].id

      await markActionFailed(actionId, 'Network error')

      const updated = await db.syncQueue.get(actionId)
      expect(updated?.attempts).toBe(1)
      expect(updated?.error).toBe('Network error')

      await markActionFailed(actionId, 'Timeout')

      const updated2 = await db.syncQueue.get(actionId)
      expect(updated2?.attempts).toBe(2)
      expect(updated2?.error).toBe('Timeout')
    })
  })

  describe('removeActionsForRecord', () => {
    it('removes only matching actions', async () => {
      const customer1 = makeCustomer({ id: 'c1' })
      const customer2 = makeCustomer({ id: 'c2' })

      await enqueueSyncAction('customers', 'c1', 'create', customer1)
      await enqueueSyncAction('customers', 'c1', 'update', customer1)
      await enqueueSyncAction('customers', 'c2', 'create', customer2)

      let actions = await getPendingActions()
      expect(actions).toHaveLength(3)

      await removeActionsForRecord('customers', 'c1')

      actions = await getPendingActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].recordId).toBe('c2')
    })
  })
})
