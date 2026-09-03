import type { Customer, KhataEntity, Payment, Sale, UdhaarEntry } from '../../core/types'
import { addCustomer, deleteCustomer, getCustomerById, restoreCustomer, searchCustomers, updateCustomer } from '../../data/repositories/customerRepo'
import { addUdhaar, deleteUdhaar, getUdhaarByCustomer, restoreUdhaar, updateUdhaar } from '../../data/repositories/udhaarRepo'
import { addPayment, deletePayment, getPaymentsByCustomer, restorePayment, updatePayment } from '../../data/repositories/paymentRepo'
import { addSale, deleteSale, restoreSale } from '../../data/repositories/saleRepo'
import { matchCustomers } from './nlp'

type Owner = { userId: string; shopId: string }

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string }

// Tool permission levels for security enforcement
export type ToolPermission = 'read' | 'write' | 'high_risk'

export type ToolMetadata = {
  name: string
  permission: ToolPermission
  requiresConfirmation: boolean
  description: string
}

// Permission registry — maps tool names to their metadata
export const TOOL_REGISTRY: Record<string, ToolMetadata> = {
  // READ tools — no confirmation needed
  searchCustomer: { name: 'searchCustomer', permission: 'read', requiresConfirmation: false, description: 'Search customers by name or phone' },
  getCustomer: { name: 'getCustomer', permission: 'read', requiresConfirmation: false, description: 'Get customer details by ID' },
  getCustomerBalance: { name: 'getCustomerBalance', permission: 'read', requiresConfirmation: false, description: 'Get customer outstanding balance' },
  getCustomerLedger: { name: 'getCustomerLedger', permission: 'read', requiresConfirmation: false, description: 'Get customer transaction history' },
  getPaymentsByCustomer: { name: 'getPaymentsByCustomer', permission: 'read', requiresConfirmation: false, description: 'Get customer payment history' },
  getUdhaarByCustomer: { name: 'getUdhaarByCustomer', permission: 'read', requiresConfirmation: false, description: 'Get customer udhaar entries' },

  // WRITE tools — confirmation required
  createCustomer: { name: 'createCustomer', permission: 'write', requiresConfirmation: true, description: 'Create a new customer' },
  addUdhaar: { name: 'addUdhaar', permission: 'write', requiresConfirmation: true, description: 'Add udhaar entry for customer' },
  recordPayment: { name: 'recordPayment', permission: 'write', requiresConfirmation: true, description: 'Record a payment for customer' },
  recordSale: { name: 'recordSale', permission: 'write', requiresConfirmation: true, description: 'Record a sale' },

  // HIGH RISK tools — explicit confirmation required, logged
  deleteCustomer: { name: 'deleteCustomer', permission: 'high_risk', requiresConfirmation: true, description: 'Delete a customer (soft delete)' },
  deleteUdhaar: { name: 'deleteUdhaar', permission: 'high_risk', requiresConfirmation: true, description: 'Delete an udhaar entry (soft delete)' },
  deletePayment: { name: 'deletePayment', permission: 'high_risk', requiresConfirmation: true, description: 'Delete a payment (soft delete)' },
  deleteSale: { name: 'deleteSale', permission: 'high_risk', requiresConfirmation: true, description: 'Delete a sale (soft delete)' },

  // RESTORE tools — confirmation required
  restoreCustomer: { name: 'restoreCustomer', permission: 'write', requiresConfirmation: true, description: 'Restore a deleted customer' },
  restoreUdhaar: { name: 'restoreUdhaar', permission: 'write', requiresConfirmation: true, description: 'Restore a deleted udhaar entry' },
  restorePayment: { name: 'restorePayment', permission: 'write', requiresConfirmation: true, description: 'Restore a deleted payment' },
  restoreSale: { name: 'restoreSale', permission: 'write', requiresConfirmation: true, description: 'Restore a deleted sale' },

  // UPDATE tools — confirmation required
  updateCustomer: { name: 'updateCustomer', permission: 'write', requiresConfirmation: true, description: 'Update customer details' },
  updateUdhaar: { name: 'updateUdhaar', permission: 'write', requiresConfirmation: true, description: 'Update an udhaar entry' },
  updatePayment: { name: 'updatePayment', permission: 'write', requiresConfirmation: true, description: 'Update a payment' },
}

/** Check if a tool requires confirmation before execution */
export function requiresConfirmation(toolName: string): boolean {
  return TOOL_REGISTRY[toolName]?.requiresConfirmation ?? true
}

/** Get the permission level for a tool */
export function getToolPermission(toolName: string): ToolPermission {
  return TOOL_REGISTRY[toolName]?.permission ?? 'high_risk'
}

/** Validate tool arguments — returns error message if invalid, null if valid */
export function validateToolArgs(toolName: string, args: Record<string, unknown>): string | null {
  switch (toolName) {
    case 'createCustomer':
      if (!args.name || typeof args.name !== 'string' || args.name.trim().length === 0) {
        return 'Customer name is required'
      }
      if (args.phone !== undefined && typeof args.phone !== 'string') {
        return 'Phone must be a string'
      }
      return null

    case 'addUdhaar':
    case 'recordPayment':
    case 'recordSale':
      if (typeof args.amount !== 'number' || args.amount <= 0) {
        return 'Amount must be a positive number'
      }
      if (args.amount > 999999999) {
        return 'Amount exceeds maximum allowed value'
      }
      return null

    case 'deleteCustomer':
    case 'deleteUdhaar':
    case 'deletePayment':
    case 'deleteSale':
      if (!args.id || typeof args.id !== 'string') {
        return 'Record ID is required for deletion'
      }
      return null

    case 'restoreCustomer':
    case 'restoreUdhaar':
    case 'restorePayment':
    case 'restoreSale':
      if (!args.id || typeof args.id !== 'string') {
        return 'Record ID is required for restore'
      }
      return null

    case 'updateCustomer':
      if (!args.id || typeof args.id !== 'string') {
        return 'Customer ID is required'
      }
      return null

    case 'updateUdhaar':
    case 'updatePayment':
      if (!args.id || typeof args.id !== 'string') {
        return 'Record ID is required'
      }
      if (args.amount !== undefined && (typeof args.amount !== 'number' || args.amount <= 0)) {
        return 'Amount must be a positive number'
      }
      return null

    default:
      return null
  }
}

export async function aiCreateCustomer(
  name: string,
  phone: string | undefined,
  owner: Owner,
  address?: string,
): Promise<ToolResult<Customer>> {
  try {
    const customer = await addCustomer(
      { name, phone: phone ?? '', address: address || undefined },
      owner,
    )
    const safeCustomer = customer
    return { ok: true, data: safeCustomer as Customer }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to create customer: ${error}` }
  }
}

export function aiFindCustomer(
  nameOrPhone: string,
  customers: Customer[],
): { status: 'unique'; customer: Customer } | { status: 'ambiguous'; candidates: Customer[] } | { status: 'none' } {
  return matchCustomers(nameOrPhone, customers)
}

export async function aiAddUdhaar(
  customerId: string,
  amount: number,
  description: string,
  owner: Owner,
): Promise<ToolResult<UdhaarEntry>> {
  try {
    const entry = await addUdhaar(
      { customerId, amount, description },
      owner,
    )
    return { ok: true, data: entry }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to add udhaar: ${error}` }
  }
}

export async function aiRecordPayment(
  customerId: string,
  amount: number,
  method: Payment['method'],
  udhaarId: string | undefined,
  owner: Owner,
  date?: string,
): Promise<ToolResult<Payment>> {
  try {
    const payment = await addPayment(
      { customerId, amount, method, udhaarId, date: date ?? new Date().toISOString().split('T')[0] },
      owner,
    )
    return { ok: true, data: payment }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to record payment: ${error}` }
  }
}

export async function aiRecordSale(
  customerId: string | undefined,
  amount: number,
  description: string,
  owner: Owner,
  date?: string,
): Promise<ToolResult<Sale>> {
  try {
    const sale = await addSale(
      { customerId, amount, description, date: date ?? new Date().toISOString().split('T')[0] },
      owner,
    )
    return { ok: true, data: sale }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to record sale: ${error}` }
  }
}

export async function aiDeleteUdhaar(udhaarId: string): Promise<ToolResult<void>> {
  try {
    await deleteUdhaar(udhaarId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to delete udhaar: ${error}` }
  }
}

export async function aiDeletePayment(paymentId: string): Promise<ToolResult<void>> {
  try {
    await deletePayment(paymentId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to delete payment: ${error}` }
  }
}

export async function aiDeleteCustomer(customerId: string): Promise<ToolResult<void>> {
  try {
    await deleteCustomer(customerId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to delete customer: ${error}` }
  }
}

export async function aiDeleteSale(saleId: string): Promise<ToolResult<void>> {
  try {
    await deleteSale(saleId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to delete sale: ${error}` }
  }
}

export async function aiRestoreCustomer(customerId: string): Promise<ToolResult<void>> {
  try {
    await restoreCustomer(customerId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to restore customer: ${error}` }
  }
}

export async function aiRestoreUdhaar(udhaarId: string): Promise<ToolResult<void>> {
  try {
    await restoreUdhaar(udhaarId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to restore udhaar: ${error}` }
  }
}

export async function aiRestorePayment(paymentId: string): Promise<ToolResult<void>> {
  try {
    await restorePayment(paymentId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to restore payment: ${error}` }
  }
}

export async function aiRestoreSale(saleId: string): Promise<ToolResult<void>> {
  try {
    await restoreSale(saleId)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to restore sale: ${error}` }
  }
}

export async function aiUpdateCustomer(
  customerId: string,
  changes: { name?: string; phone?: string; address?: string },
): Promise<ToolResult<Customer>> {
  try {
    await updateCustomer(customerId, changes)
    const updated = await getCustomerById(customerId)
    if (!updated) return { ok: false, error: 'not-found', message: 'Customer not found after update' }
    const safeCustomer = updated
    return { ok: true, data: safeCustomer as Customer }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to update customer: ${error}` }
  }
}

export async function aiUpdateUdhaar(
  udhaarId: string,
  changes: { amount?: number; description?: string; dueDate?: string },
): Promise<ToolResult<void>> {
  try {
    await updateUdhaar(udhaarId, changes)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to update udhaar: ${error}` }
  }
}

export async function aiUpdatePayment(
  paymentId: string,
  changes: { amount?: number; method?: Payment['method']; date?: string },
): Promise<ToolResult<void>> {
  try {
    await updatePayment(paymentId, changes)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: 'repo-error', message: `Failed to update payment: ${error}` }
  }
}

export function aiGetBalance(
  customerId: string,
  udhaar: UdhaarEntry[],
): { outstanding: number; total: number; paid: number; entries: UdhaarEntry[] } {
  // CRITICAL: Only include non-deleted udhaar entries
  const customerUdhaar = udhaar.filter((e) => e.customerId === customerId && !e.isDeleted)
  const outstanding = customerUdhaar.reduce((sum, e) => sum + Math.max(0, e.remainingAmount), 0)
  const total = customerUdhaar.reduce((sum, e) => sum + e.amount, 0)
  const paid = customerUdhaar.reduce((sum, e) => sum + e.paidAmount, 0)
  return { outstanding, total, paid, entries: customerUdhaar }
}

export function aiGetHistory(
  customerId: string,
  data: { udhaar: UdhaarEntry[]; payments: Payment[]; sales: Sale[] },
): { date: string; kind: 'udhaar' | 'payment' | 'sale'; entity: KhataEntity }[] {
  const lines: { date: string; kind: 'udhaar' | 'payment' | 'sale'; entity: KhataEntity }[] = []

  for (const e of data.udhaar) {
    if (e.customerId === customerId && !e.isDeleted) {
      lines.push({ date: e.createdAt, kind: 'udhaar', entity: e })
    }
  }
  for (const p of data.payments) {
    if (p.customerId === customerId && !p.isDeleted) {
      lines.push({ date: p.date, kind: 'payment', entity: p })
    }
  }
  for (const s of data.sales) {
    if (s.customerId === customerId && !s.isDeleted) {
      lines.push({ date: s.date, kind: 'sale', entity: s })
    }
  }

  return lines.sort((a, b) => b.date.localeCompare(a.date))
}

export async function aiGetCustomerById(id: string): Promise<Customer | undefined> {
  // Customer records carry no sensitive CNIC data, so the record is returned as-is.
  return getCustomerById(id)
}

export async function aiSearchCustomers(query: string): Promise<Customer[]> {
  // Customer records carry no sensitive CNIC data, so records are returned as-is.
  return searchCustomers(query)
}

export async function aiGetUdhaarByCustomer(customerId: string): Promise<UdhaarEntry[]> {
  return getUdhaarByCustomer(customerId)
}

export async function aiGetPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  return getPaymentsByCustomer(customerId)
}
