import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, ShoppingBag, Package, X } from 'lucide-react'

import { Button } from './ui/Button'
import { formatCurrency } from '../lib/utils'
import {
  blankBillItem,
  billTotal,
  hasValidItems,
} from '../lib/bill'
import {
  getSavedProducts,
  saveProducts,
  deleteProduct,
  subscribeToProducts,
  type SavedProduct,
} from '../data/services/savedProducts'
import type { BillItem } from '../core/types'

type BillItemsEditorProps = {
  shopId: string
  items: BillItem[]
  onChange: (items: BillItem[]) => void
  onTotalExpected?: (total: number) => void
}

export function BillItemsEditor({ shopId, items, onChange, onTotalExpected }: BillItemsEditorProps) {
  const [products, setProducts] = useState<SavedProduct[]>(() => getSavedProducts(shopId))
  const [showProducts, setShowProducts] = useState(false)

  useEffect(() => {
    const unsub = subscribeToProducts(() => {
      setProducts(getSavedProducts(shopId))
    })
    return unsub
  }, [shopId])

  const valid = hasValidItems(items)
  const total = useMemo(() => billTotal(items), [items])

  useEffect(() => {
    if (valid) onTotalExpected?.(total)
  }, [valid, total, onTotalExpected])

  const nameOptions = useMemo(() => products.map((p) => p.name), [products])

  function addItemRow() {
    onChange([...items, blankBillItem()])
  }

  function removeItemRow(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function updateItemRow(index: number, patch: Partial<BillItem>) {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item
        const merged = { ...item, ...patch }
        const qty = Number(merged.qty) || 0
        const rate = Number(merged.rate) || 0
        merged.amount = Math.round(qty * rate * 100) / 100
        return merged
      }),
    )
  }

  function onNameChange(index: number, name: string) {
    updateItemRow(index, { name })
    const match = products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())
    if (match) {
      updateItemRow(index, { name, rate: match.rate })
    }
  }

  function addProduct(product: SavedProduct) {
    onChange([...items, { name: product.name, qty: 1, rate: product.rate, amount: product.rate }])
  }

  function learnAndRemove(product: SavedProduct) {
    deleteProduct(shopId, product.id)
  }

  function learnAllFromItems() {
    if (!valid) return
    saveProducts(
      shopId,
      items.filter((i) => i.name.trim() !== '').map((i) => ({ name: i.name, rate: i.rate })),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-light">
          <ShoppingBag size={15} />
          Items
        </span>
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowProducts((v) => !v)} className="h-9 px-3 text-xs">
              <Package size={14} />
              Saved ({products.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addItemRow} className="h-9 px-3 text-xs">
            <Plus size={14} />
            Add item
          </Button>
        </div>
      </div>

      {products.length > 0 && showProducts && (
        <div className="rounded-xl border border-surface-hairline bg-surface p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Tap to add — saved products
          </p>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <div key={p.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-success-50 hover:text-success-600"
                >
                  {p.name}
                  <span className="text-ink-muted">{formatCurrency(p.rate)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => learnAndRemove(p)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-ink-subtle transition hover:bg-danger/10 hover:text-danger"
                  aria-label={`Remove ${p.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-hairline bg-surface px-4 py-3 text-xs text-ink-muted">
          Add items (qty × rate) for a detailed bill. Leave empty to enter a single amount.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const rowTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0)
            return (
              <div key={index} className="rounded-xl border border-surface-hairline bg-surface p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_90px_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => onNameChange(index, e.target.value)}
                      placeholder="Item name"
                      list={`bill-product-list-${shopId}`}
                      className="h-11 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      value={item.qty || ''}
                      onChange={(e) => updateItemRow(index, { qty: Number(e.target.value) })}
                      placeholder="Qty"
                      title="Quantity"
                      className="h-11 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={item.rate || ''}
                      onChange={(e) => updateItemRow(index, { rate: Number(e.target.value) })}
                      placeholder="Rate"
                      title="Rate (Rs.)"
                      className="h-11 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                    <span className="text-sm font-semibold text-ink tabular-nums">
                      {formatCurrency(rowTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {valid && (
            <div className="flex items-center justify-between rounded-xl bg-success-50 px-4 py-3">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="text-lg font-bold text-success-600 tabular-nums">
                {formatCurrency(total)}
              </span>
            </div>
          )}
        </div>
      )}

      <datalist id={`bill-product-list-${shopId}`}>
        {nameOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {valid && (
        <button
          type="button"
          onClick={learnAllFromItems}
          className="text-xs font-semibold text-primary-500 transition hover:text-primary-600"
        >
          + Save these items as products for next time
        </button>
      )}
    </div>
  )
}
