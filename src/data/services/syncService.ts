import type {
  Customer,
  KhataEntity,
  KhataTable,
  Payment,
  Sale,
  SyncAction,
  UdhaarEntry,
} from '../../core/types'
import { db } from '../db/db'
import type { CloudProvider } from '../cloud/CloudProvider'
import { restCloudProvider } from '../cloud/restCloudProvider'
import {
  getPendingActions,
  markActionFailed,
  markActionSucceeded,
} from '../repositories/syncQueueRepo'
import { getLastSyncAt, networkService, setLastSyncAt } from './networkService'

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]

class SyncService {
  private provider: CloudProvider = restCloudProvider
  private syncState: 'idle' | 'syncing' | 'error' = 'idle'
  private listeners = new Set<(state: typeof this.syncState) => void>()

  constructor() {
    networkService.subscribe((online) => {
      if (online) {
        void this.sync()
      }
    })
  }

  setProvider(provider: CloudProvider): void {
    this.provider = provider
  }

  getProvider(): CloudProvider {
    return this.provider
  }

  getState(): typeof this.syncState {
    return this.syncState
  }

  subscribe(listener: (state: typeof this.syncState) => void): () => void {
    this.listeners.add(listener)
    listener(this.syncState)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(state: typeof this.syncState): void {
    this.syncState = state
    for (const listener of Array.from(this.listeners)) {
      listener(state)
    }
  }

  async sync(): Promise<boolean> {
    if (!networkService.isOnline()) {
      this.setState('idle')
      return false
    }

    if (this.syncState === 'syncing') return false

    this.setState('syncing')

    try {
      const pending = await getPendingActions()
      if (pending.length > 0) {
        const pushResult = await this.provider.push(pending)
        if (!pushResult.success) {
          await this.handlePushFailure(pending, pushResult.error)
          this.setState('error')
          return false
        }
        await this.handlePushSuccess(pending)
      }

      const since = getLastSyncAt()
      const pullResult = await this.provider.pull(since)
      if (pullResult.error) {
        this.setState('error')
        return false
      }

      await this.applyPulledRecords(pullResult.records)
      setLastSyncAt(new Date().toISOString())
      this.setState('idle')
      return true
    } catch (error) {
      this.setState('error')
      console.error('Sync failed:', error)
      return false
    }
  }

  private async handlePushSuccess(actions: SyncAction[]): Promise<void> {
    for (const action of actions) {
      await this.markRecordSynced(action.table, action.recordId)
      await markActionSucceeded(action.id)
    }
  }

  private async handlePushFailure(
    actions: SyncAction[],
    error?: string,
  ): Promise<void> {
    let minAttempts = Infinity
    for (const action of actions) {
      const attempts = action.attempts + 1
      minAttempts = Math.min(minAttempts, attempts)
      await markActionFailed(action.id, error ?? 'Sync failed')
    }

    const delay = RETRY_DELAYS[Math.min(minAttempts, RETRY_DELAYS.length - 1)]
    setTimeout(() => {
      void this.sync()
    }, delay)
  }

  private async markRecordSynced(
    table: KhataTable,
    recordId: string,
  ): Promise<void> {
    const tableMap = {
      customers: db.customers,
      udhaar: db.udhaar,
      payments: db.payments,
      sales: db.sales,
    }

    const entityTable = tableMap[table]
    const record = await entityTable.get(recordId)
    if (record && record.syncStatus === 'pending') {
      await entityTable.update(recordId, { syncStatus: 'synced' })
    }
  }

  private async applyPulledRecords(
    records: { table: KhataTable; record: KhataEntity }[],
  ): Promise<void> {
    for (const { table, record } of records) {
      await this.applyPulledRecord(table, record)
    }
  }

  private async applyPulledRecord(
    table: KhataTable,
    remote: KhataEntity,
  ): Promise<void> {
    if (table === 'customers') {
      await this.applyToTable(db.customers, remote as Customer)
    } else if (table === 'udhaar') {
      await this.applyToTable(db.udhaar, remote as UdhaarEntry)
    } else if (table === 'payments') {
      await this.applyToTable(db.payments, remote as Payment)
    } else if (table === 'sales') {
      await this.applyToTable(db.sales, remote as Sale)
    }
  }

  private async applyToTable<T extends KhataEntity>(
    table: {
      get: (id: string) => Promise<T | undefined>
      add: (record: T) => Promise<string | number>
      put: (record: T) => Promise<string | number>
      update: (id: string, changes: Partial<T>) => Promise<number>
    },
    remote: T,
  ): Promise<void> {
    const local = await table.get(remote.id)

    if (!local) {
      await table.add(remote)
      return
    }

    // Preserve pending local changes.
    if (local.syncStatus === 'pending') {
      return
    }

    // Conflict: remote is newer.
    if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
      await table.put(remote)
      return
    }

    // Local is newer: mark conflict for user review.
    if (new Date(remote.updatedAt) < new Date(local.updatedAt)) {
      await table.update(remote.id, { syncStatus: 'conflict' } as Partial<T>)
    }
  }
}

export const syncService = new SyncService()
