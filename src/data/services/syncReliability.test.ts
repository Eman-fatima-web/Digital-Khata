import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Customer, SyncAction } from '../../core/types'
import { db } from '../../data/db/db'
import { syncService } from '../../data/services/syncService'
import { networkService } from '../../data/services/networkService'
import { enqueueSyncAction, getPendingActions, markActionFailed } from '../../data/repositories/syncQueueRepo'
import { generateId } from '../../lib/utils'
import type { CloudProvider } from '../../data/cloud/CloudProvider'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? generateId(),
    userId: 'user-1',
    shopId: 'shop-1',
    name: overrides.name ?? 'Test Customer',
    phone: overrides.phone ?? '03001234567',
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

describe('Sync Reliability', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
    await db.syncQueue.clear()
    await db.syncConflicts.clear()
  })

  describe('Atomic writes', () => {
    it('customer creation is atomic (record + sync action)', async () => {
      const customer = makeCustomer({ id: 'c1', syncStatus: 'pending' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const record = await db.customers.get('c1')
      const actions = await getPendingActions()

      expect(record).toBeDefined()
      expect(record?.syncStatus).toBe('pending')
      expect(actions).toHaveLength(1)
      expect(actions[0].table).toBe('customers')
      expect(actions[0].recordId).toBe('c1')
    })
  })

  describe('Retry limits', () => {
    it('marks action failed with incrementing attempts', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const actions = await getPendingActions()
      await markActionFailed(actions[0].id, 'Network error')

      const updated = await db.syncQueue.get(actions[0].id)
      expect(updated?.attempts).toBe(1)
      expect(updated?.error).toBe('Network error')

      await markActionFailed(actions[0].id, 'Timeout')
      const updated2 = await db.syncQueue.get(actions[0].id)
      expect(updated2?.attempts).toBe(2)
    })

    it('sync service removes actions after MAX_RETRY_ATTEMPTS', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await db.customers.add(customer)

      // Create an action with attempts already at max
      const action: SyncAction = {
        id: 'action-max',
        table: 'customers',
        recordId: 'c1',
        operation: 'create',
        payload: customer,
        createdAt: new Date().toISOString(),
        attempts: 20, // MAX_RETRY_ATTEMPTS
      }
      await db.syncQueue.add(action)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: false, error: 'Server error' }),
      })
      syncService.setProvider(provider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)

      await syncService.sync()

      // Action should be removed after exceeding max attempts
      const remaining = await db.syncQueue.get('action-max')
      expect(remaining).toBeUndefined()
    })
  })

  describe('Conflict handling', () => {
    it('stores conflict and removes action from queue', async () => {
      const customer = makeCustomer({ id: 'c1', name: 'Local', version: 1 })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'update', customer)

      const remoteCustomer = makeCustomer({ id: 'c1', name: 'Remote', version: 2 })

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({
          success: true,
          conflicts: [{ table: 'customers', recordId: 'c1', remote: remoteCustomer }],
        }),
      })
      syncService.setProvider(provider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)

      await syncService.sync()

      // Conflict should be stored
      const conflicts = await db.syncConflicts.toArray()
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].recordId).toBe('c1')

      // Action should be removed from queue
      const actions = await getPendingActions()
      expect(actions).toHaveLength(0)
    })
  })

  describe('Concurrency protection', () => {
    it('prevents concurrent sync calls', async () => {
      const provider = makeMockProvider()
      syncService.setProvider(provider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)

      // Start two syncs simultaneously
      const [result1, result2] = await Promise.all([
        syncService.sync(),
        syncService.sync(),
      ])

      // Both should return the same result (same promise)
      expect(result1).toBe(result2)
      // Provider should only be called once
      expect(provider.push).toHaveBeenCalledTimes(0) // No pending actions
    })
  })

  describe('Queue recovery', () => {
    it('preserves queue across sync failures', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: false, error: 'Network error' }),
      })
      syncService.setProvider(provider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)

      await syncService.sync()

      // Queue should still have the action
      const actions = await getPendingActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].attempts).toBe(1)
    })

    it('successfully syncs after recovery', async () => {
      const customer = makeCustomer({ id: 'c1' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      // First sync fails
      const failProvider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: false, error: 'Network error' }),
      })
      syncService.setProvider(failProvider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)
      await syncService.sync()

      // Second sync succeeds
      const successProvider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
      })
      syncService.setProvider(successProvider)
      await syncService.sync()

      // Queue should be empty
      const actions = await getPendingActions()
      expect(actions).toHaveLength(0)

      // Record should be synced
      const record = await db.customers.get('c1')
      expect(record?.syncStatus).toBe('synced')
    })
  })

  describe('Offline → Online synchronization', () => {
    it('queues actions while offline', async () => {
      const customer = makeCustomer({ id: 'c1', syncStatus: 'pending' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      vi.spyOn(networkService, 'isOnline').mockReturnValue(false)

      // Sync should not push when offline
      const provider = makeMockProvider()
      syncService.setProvider(provider)
      await syncService.sync()

      expect(provider.push).not.toHaveBeenCalled()

      // Queue should still have the action
      const actions = await getPendingActions()
      expect(actions).toHaveLength(1)
    })

    it('syncs queued actions when coming online', async () => {
      const customer = makeCustomer({ id: 'c1', syncStatus: 'pending' })
      await db.customers.add(customer)
      await enqueueSyncAction('customers', 'c1', 'create', customer)

      const provider = makeMockProvider({
        push: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
      })
      syncService.setProvider(provider)
      vi.spyOn(networkService, 'isOnline').mockReturnValue(true)

      await syncService.sync()

      expect(provider.push).toHaveBeenCalled()
      const actions = await getPendingActions()
      expect(actions).toHaveLength(0)
    })
  })
})
