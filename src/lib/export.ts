import { formatCurrency, formatDate } from './utils'

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

export function customerExportRows(
  customers: Array<{ name: string; phone?: string; address?: string; outstanding: number }>,
): Record<string, unknown>[] {
  return customers.map((c) => ({
    Name: c.name,
    Phone: c.phone || '',
    Address: c.address || '',
    Outstanding: c.outstanding,
  }))
}

export function transactionExportRows(
  transactions: Array<{
    type: string
    customerName: string
    description: string
    amount: number
    date: string
  }>,
): Record<string, unknown>[] {
  return transactions.map((t) => ({
    Date: formatDate(t.date),
    Type: t.type,
    Customer: t.customerName,
    Description: t.description,
    Amount: t.amount,
    'Amount (Formatted)': formatCurrency(t.amount),
  }))
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
