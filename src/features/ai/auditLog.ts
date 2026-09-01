import type { ActionKind, ActionProposal } from '../../core/types'

/**
 * Audit log entry for AI actions.
 * Records tool calls, results, and context without logging sensitive data.
 * Never logs: passwords, PINs, API keys, or raw customer messages.
 */
export type AuditLogEntry = {
  id: string
  timestamp: string
  action: ActionKind
  toolName?: string
  customerId?: string
  amount?: number
  recordId?: string
  result: 'confirmed' | 'cancelled' | 'failed'
  errorMessage?: string
}

const AUDIT_LOG_KEY = 'dk-ai-audit-log'
const MAX_LOG_ENTRIES = 500

/** Generate a simple unique ID for audit entries */
function auditId(): string {
  return `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Read audit log from localStorage */
function readLog(): AuditLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AuditLogEntry[]
  } catch {
    return []
  }
}

/** Write audit log to localStorage */
function writeLog(entries: AuditLogEntry[]): void {
  if (typeof window === 'undefined') return
  // Keep only the most recent entries to prevent unbounded growth
  const trimmed = entries.slice(-MAX_LOG_ENTRIES)
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmed))
}

/** Log a confirmed AI action */
export function logActionConfirmed(proposal: ActionProposal): void {
  const entry: AuditLogEntry = {
    id: auditId(),
    timestamp: new Date().toISOString(),
    action: proposal.kind,
    customerId: proposal.customerId,
    amount: proposal.amount,
    recordId: proposal.udhaarId ?? proposal.paymentId,
    result: 'confirmed',
  }
  const log = readLog()
  log.push(entry)
  writeLog(log)
}

/** Log a cancelled AI action */
export function logActionCancelled(proposal: ActionProposal): void {
  const entry: AuditLogEntry = {
    id: auditId(),
    timestamp: new Date().toISOString(),
    action: proposal.kind,
    customerId: proposal.customerId,
    amount: proposal.amount,
    result: 'cancelled',
  }
  const log = readLog()
  log.push(entry)
  writeLog(log)
}

/** Log a failed AI action */
export function logActionFailed(proposal: ActionProposal, error: string): void {
  const entry: AuditLogEntry = {
    id: auditId(),
    timestamp: new Date().toISOString(),
    action: proposal.kind,
    customerId: proposal.customerId,
    amount: proposal.amount,
    result: 'failed',
    errorMessage: error.slice(0, 200), // Truncate to prevent unbounded growth
  }
  const log = readLog()
  log.push(entry)
  writeLog(log)
}

/** Get all audit log entries */
export function getAuditLog(): AuditLogEntry[] {
  return readLog()
}

/** Clear the audit log */
export function clearAuditLog(): void {
  writeLog([])
}

/** Get audit log entry count */
export function getAuditLogCount(): number {
  return readLog().length
}
