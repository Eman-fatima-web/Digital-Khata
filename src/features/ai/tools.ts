import type { Customer, KhataEntity, Payment, Sale, UdhaarEntry } from '../../core/types'
import { addCustomer, deleteCustomer, getCustomerById, searchCustomers } from '../../data/repositories/customerRepo'
import { addUdhaar, deleteUdhaar, getUdhaarByCustomer } from '../../data/repositories/udhaarRepo'
import { addPayment, deletePayment, getPaymentsByCustomer } from '../../data/repositories/paymentRepo'
import { addSale } from '../../data/repositories/saleRepo'
import { matchCustomers } from './nlp'

type Owner = { userId: string; shopId: string }

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string }

export async function aiCreateCustomer(
  name: string,
  phone: string | undefined,
  owner: Owner,
): Promise<ToolResult<Customer>> {
  try {
    const customer = await addCustomer({ name, phone: phone ?? '' }, owner)
    return { ok: true, data: customer }
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
): Promise<ToolResult<Payment>> {
  try {
    const payment = await addPayment(
      { customerId, amount, method, udhaarId, date: new Date().toISOString().split('T')[0] },
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
): Promise<ToolResult<Sale>> {
  try {
    const sale = await addSale(
      { customerId, amount, description, date: new Date().toISOString().split('T')[0] },
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

export function aiGetBalance(
  customerId: string,
  udhaar: UdhaarEntry[],
): { outstanding: number; total: number; paid: number; entries: UdhaarEntry[] } {
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
  return getCustomerById(id)
}

export async function aiSearchCustomers(query: string): Promise<Customer[]> {
  return searchCustomers(query)
}

export async function aiGetUdhaarByCustomer(customerId: string): Promise<UdhaarEntry[]> {
  return getUdhaarByCustomer(customerId)
}

export async function aiGetPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  return getPaymentsByCustomer(customerId)
}
