import type { BillItem } from '../core/types'

export const EMPTY_BILL_ITEM: BillItem = { name: '', qty: 1, rate: 0, amount: 0 }

export function blankBillItem(): BillItem {
  return { ...EMPTY_BILL_ITEM }
}

export function computeBillItemAmount(item: BillItem): number {
  return Math.round((item.qty * item.rate) * 100) / 100
}

export function billTotal(items: BillItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + computeBillItemAmount(i), 0) * 100) / 100
}

export function hasValidItems(items?: BillItem[]): boolean {
  return !!items && items.length > 0 && items.some((i) => i.name.trim() !== '' && i.rate > 0 && i.qty > 0)
}
