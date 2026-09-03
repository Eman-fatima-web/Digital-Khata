import { db } from '../db/db'

const BACKUP_VERSION = 1
const BACKUP_FILENAME_PREFIX = 'digital-khata-backup'

type BackupData = {
  version: number
  exportedAt: string
  customers: unknown[]
  udhaar: unknown[]
  payments: unknown[]
  sales: unknown[]
  aiMessages: unknown[]
  conversations: unknown[]
}

export async function exportBackup(): Promise<string> {
  const [customers, udhaar, payments, sales, aiMessages, conversations] = await Promise.all([
    db.customers.toArray(),
    db.udhaar.toArray(),
    db.payments.toArray(),
    db.sales.toArray(),
    db.aiMessages.toArray(),
    db.conversations.toArray(),
  ])

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    customers,
    udhaar,
    payments,
    sales,
    aiMessages,
    conversations,
  }

  return JSON.stringify(backup, null, 2)
}

export function downloadBackup(json: string): void {
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${BACKUP_FILENAME_PREFIX}-v${BACKUP_VERSION}-${date}.json`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

type RestoreResult = {
  success: boolean
  counts: {
    customers: number
    udhaar: number
    payments: number
    sales: number
    aiMessages: number
    conversations: number
  }
  error?: string
}

function validateBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.version !== 'number') return false
  if (obj.version > BACKUP_VERSION) return false
  if (!Array.isArray(obj.customers)) return false
  if (!Array.isArray(obj.udhaar)) return false
  if (!Array.isArray(obj.payments)) return false
  if (!Array.isArray(obj.sales)) return false
  return true
}

export async function importBackup(json: string): Promise<RestoreResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { success: false, counts: emptyCounts(), error: 'Invalid JSON file' }
  }

  if (!validateBackup(data)) {
    return { success: false, counts: emptyCounts(), error: 'Invalid backup format' }
  }

  try {
    await db.transaction('rw', [db.customers, db.udhaar, db.payments, db.sales, db.aiMessages, db.conversations], async () => {
      await db.customers.clear()
      await db.udhaar.clear()
      await db.payments.clear()
      await db.sales.clear()
      await db.aiMessages.clear()
      await db.conversations.clear()

      if (data.customers.length > 0) await db.customers.bulkAdd(data.customers as never[])
      if (data.udhaar.length > 0) await db.udhaar.bulkAdd(data.udhaar as never[])
      if (data.payments.length > 0) await db.payments.bulkAdd(data.payments as never[])
      if (data.sales.length > 0) await db.sales.bulkAdd(data.sales as never[])
      if (data.aiMessages.length > 0) await db.aiMessages.bulkAdd(data.aiMessages as never[])
      if (data.conversations.length > 0) await db.conversations.bulkAdd(data.conversations as never[])
    })

    return {
      success: true,
      counts: {
        customers: data.customers.length,
        udhaar: data.udhaar.length,
        payments: data.payments.length,
        sales: data.sales.length,
        aiMessages: data.aiMessages.length,
        conversations: data.conversations.length,
      },
    }
  } catch (err) {
    return {
      success: false,
      counts: emptyCounts(),
      error: err instanceof Error ? err.message : 'Restore failed',
    }
  }
}

function emptyCounts() {
  return { customers: 0, udhaar: 0, payments: 0, sales: 0, aiMessages: 0, conversations: 0 }
}
