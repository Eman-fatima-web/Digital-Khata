import type { KhataEntity, KhataTable, SyncAction } from '../../core/types'

export type SyncResult = {
  success: boolean
  conflicts?: SyncConflict[]
  error?: string
}

export type SyncConflict = {
  table: KhataTable
  recordId: string
  local: KhataEntity
  remote: KhataEntity
}

export type PullResult = {
  records: PulledRecord[]
  error?: string
}

export type PulledRecord = {
  table: KhataTable
  record: KhataEntity
}

export type CloudCredentials = {
  accessToken: string
  refreshToken?: string
}

export interface CloudProvider {
  name: string
  authenticate(credentials: CloudCredentials): Promise<boolean>
  push(actions: SyncAction[]): Promise<SyncResult>
  pull(since?: string): Promise<PullResult>
  getServerTime?(): Promise<string>
}
