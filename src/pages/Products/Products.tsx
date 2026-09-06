import { useEffect, useMemo, useState } from 'react'
import { PackagePlus, Package, Boxes, Search, Trash2, PenLine, Check, X, AlertTriangle, TrendingUp, Coins, Download } from 'lucide-react'
import { useTranslation } from '../../core/i18n'
import { useOwner } from '../../hooks/useOwner'
import { useSales } from '../../hooks/useKhataData'
import { useToast } from '../../components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  getSavedProducts,
  saveProducts,
  updateProduct,
  deleteProduct,
  subscribeToProducts,
  type SavedProduct,
} from '../../data/services/savedProducts'
import { formatCurrency, formatDate } from '../../lib/utils'
import { downloadProductsPdf } from '../../lib/pdf'

function profitPct(p: SavedProduct): number | null {
  if (p.cost === undefined || p.rate <= 0) return null
  if (p.cost === 0) return 100
  return Math.round(((p.rate - p.cost) / p.cost) * 100)
}

export default function Products() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const owner = useOwner()
  const shopId = owner.shopId

  const [products, setProducts] = useState<SavedProduct[]>(() => getSavedProducts(shopId))
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editStock, setEditStock] = useState('')

  useEffect(() => {
    return subscribeToProducts(() => setProducts(getSavedProducts(shopId)))
  }, [shopId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [products, query])

  const totalStock = products.reduce((sum, p) => sum + (p.stock ?? 0), 0)
  const lowStockCount = products.filter((p) => (p.stock ?? 0) <= 5).length
  const totalInvestment = products.reduce((sum, p) => sum + (p.cost ?? 0) * (p.stock ?? 0), 0)
  const totalStockValue = products.reduce((sum, p) => sum + (p.rate || 0) * (p.stock ?? 0), 0)
  const potentialProfit = totalStockValue - totalInvestment

  const sales = useSales()
  const soldProfit = useMemo(() => {
    if (!sales) return null
    const costByKey = new Map(
      products.filter((p) => p.cost !== undefined).map((p) => [p.name.toLowerCase().trim(), p.cost!]),
    )
    let revenue = 0
    let costTotal = 0
    let units = 0
    for (const sale of sales) {
      if (!sale.items) continue
      for (const item of sale.items) {
        const qty = Number(item.qty) || 0
        const rate = Number(item.rate) || 0
        const name = item.name.trim()
        if (!name || qty <= 0 || rate <= 0) continue
        revenue += qty * rate
        units += qty
        const cost = costByKey.get(name.toLowerCase())
        if (cost !== undefined) costTotal += qty * cost
      }
    }
    return { revenue, costTotal, profit: revenue - costTotal, units }
  }, [sales, products])

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast('error', t('products.nameRequired'))
      return
    }
    const next = saveProducts(shopId, [{ name: trimmed, rate: Number(rate) || 0 }])
    setProducts(next)
    const costVal = Math.max(0, Number(cost) || 0)
    const stockVal = Math.max(0, Number(stock) || 0)
    if (costVal > 0 || stockVal > 0) {
      const product = next.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
      if (product) {
        const patch: { cost?: number; stock?: number } = {}
        if (costVal > 0) patch.cost = costVal
        if (stockVal > 0) patch.stock = stockVal
        setProducts(updateProduct(shopId, product.id, patch))
      }
    }
    setName('')
    setRate('')
    setCost('')
    setStock('')
    toast('success', t('products.added'))
  }

  function handleDelete(id: string) {
    if (!window.confirm(t('products.deleteConfirm'))) return
    const next = deleteProduct(shopId, id)
    setProducts(next)
    setEditingId(null)
    toast('success', t('products.deleted'))
  }

  function startEdit(p: SavedProduct) {
    setEditingId(p.id)
    setEditName(p.name)
    setEditRate(p.rate ? String(p.rate) : '')
    setEditCost(p.cost !== undefined ? String(p.cost) : '')
    setEditStock(p.stock !== undefined ? String(p.stock) : '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditRate('')
    setEditCost('')
    setEditStock('')
  }

  function handleUpdate(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) {
      toast('error', t('products.nameRequired'))
      return
    }
    const next = updateProduct(shopId, id, {
      name: trimmed,
      rate: Number(editRate) || 0,
      cost: editCost === '' || editCost === null ? undefined : Math.max(0, Number(editCost) || 0),
      stock: editStock === '' || editStock === null ? undefined : Math.max(0, Number(editStock) || 0),
    })
    setProducts(next)
    cancelEdit()
    toast('success', t('products.updated'))
  }

  function handleExportPdf() {
    downloadProductsPdf({
      generatedLabel: formatDate(new Date().toISOString()),
      totalProducts: products.length,
      totalStock,
      lowStock: lowStockCount,
      totalInvestment,
      stockValue: totalStockValue,
      potentialProfit,
      soldRevenue: soldProfit?.revenue ?? 0,
      soldCost: soldProfit?.costTotal ?? 0,
      soldProfit: soldProfit?.profit ?? 0,
      stockOnlyProducts: soldProfit && soldProfit.units > 0 ? 1 : 0,
      products: products.map((p) => ({
        name: p.name,
        rate: p.rate,
        cost: p.cost,
        stock: p.stock,
        margin: profitPct(p),
      })),
    })
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-success-500">{t('nav.products')}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {t('products.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            {t('products.subtitle')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Download size={15} />
          {t('products.downloadPdf')}
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
            <Package size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('products.totalProducts')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl tabular-nums">
            {products.length}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-500">
            <Boxes size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('products.totalStock')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl tabular-nums">
            {totalStock}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <AlertTriangle size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('products.lowStockTitle')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl tabular-nums">
            {lowStockCount}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-600">
            <TrendingUp size={21} />
          </div>
          <p className="mt-5 text-sm text-ink-muted">{t('products.potentialProfit')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-success-600 sm:text-3xl">
            {formatCurrency(potentialProfit)}
          </p>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.profitOverview')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-surface p-4">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Coins size={15} className="text-ink-muted" />
              {t('products.totalInvestment')}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums text-ink">
              {formatCurrency(totalInvestment)}
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Package size={15} className="text-ink-muted" />
              {t('products.stockValue')}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums text-ink">
              {formatCurrency(totalStockValue)}
            </p>
          </div>
          <div className={`rounded-xl p-4 ${potentialProfit >= 0 ? 'bg-success-50' : 'bg-danger/10'}`}>
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <TrendingUp size={15} className={potentialProfit >= 0 ? 'text-success-600' : 'text-danger'} />
              {t('products.potentialProfit')}
            </p>
            <p className={`mt-2 text-xl font-bold tabular-nums ${potentialProfit >= 0 ? 'text-success-600' : 'text-danger'}`}>
              {formatCurrency(potentialProfit)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.profitFromSales')}</CardTitle>
        </CardHeader>
        <CardContent>
          {soldProfit === null || soldProfit.units === 0 ? (
            <p className="text-sm text-ink-muted">{t('products.noSalesProfit')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-ink-muted">{t('products.soldRevenue')}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-ink">
                    {formatCurrency(soldProfit.revenue)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">{soldProfit.units} {t('products.stockUnit')}</p>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-ink-muted">{t('products.cogs')}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-ink">
                    {formatCurrency(soldProfit.costTotal)}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${soldProfit.profit >= 0 ? 'bg-success-50' : 'bg-danger/10'}`}>
                  <p className="text-sm text-ink-muted">{t('products.profitFromSales')}</p>
                  <p className={`mt-2 text-xl font-bold tabular-nums ${soldProfit.profit >= 0 ? 'text-success-600' : 'text-danger'}`}>
                    {formatCurrency(soldProfit.profit)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-muted">{t('products.profitNote')}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.addNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('products.namePlaceholder')}
              className="h-11 flex-1 rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300"
            />
            <input
              type="number"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t('products.ratePlaceholder')}
              className="h-11 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 md:w-40"
            />
            <input
              type="number"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder={t('products.costPlaceholder')}
              className="h-11 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 md:w-36"
            />
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder={t('products.stockPlaceholder')}
              className="h-11 w-full rounded-xl border border-surface-hairline bg-surface-card px-4 text-sm outline-none transition focus:border-success-300 md:w-28"
            />
            <Button onClick={handleAdd}>
              <PackagePlus size={16} />
              {t('products.addButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('products.list')}</CardTitle>
          <div className="relative sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('products.searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-surface-hairline bg-surface-card pl-9 pr-3 text-sm outline-none transition focus:border-success-300"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t('products.noProducts')}
              description={t('products.noProductsDescription')}
              className="min-h-[160px]"
            />
          ) : (
            <div className="divide-y divide-surface-hairline">
              {filtered.map((product) => {
                const editing = editingId === product.id
                return (
                  <div key={product.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
                      <Package size={18} />
                    </span>

                    {editing ? (
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 flex-1 rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300"
                        />
                        <input
                          type="number"
                          min="0"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          placeholder={t('products.ratePlaceholder')}
                          className="h-9 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300 sm:w-24"
                        />
                        <input
                          type="number"
                          min="0"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                          placeholder={t('products.costPlaceholder')}
                          className="h-9 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300 sm:w-24"
                        />
                        <input
                          type="number"
                          min="0"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                          placeholder={t('products.stockPlaceholder')}
                          className="h-9 w-full rounded-lg border border-surface-hairline bg-surface-card px-3 text-sm outline-none transition focus:border-success-300 sm:w-24"
                        />
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-ink">{product.name}</p>
                          {(product.stock ?? 0) <= 5 && product.stock !== undefined && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                              <AlertTriangle size={10} />
                            </span>
                          )}
                          {profitPct(product) !== null && (
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                profitPct(product)! >= 0 ? 'bg-success-50 text-success-600' : 'bg-danger/10 text-danger'
                              }`}
                            >
                              {profitPct(product)! >= 0 ? '+' : ''}
                              {profitPct(product)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-muted">
                          Rs. {product.rate || 0}
                          {product.cost !== undefined && (
                            <span className="text-ink-muted"> · cost Rs. {product.cost}</span>
                          )}
                          {product.stock !== undefined && ` · ${product.stock} ${t('products.stockUnit')}`}
                        </p>
                      </div>
                    )}

                    {editing ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdate(product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-success-600 transition hover:bg-success-50"
                          aria-label="Save"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface"
                          aria-label="Cancel"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 hidden text-sm font-semibold text-ink sm:inline">
                          {formatCurrency(product.rate || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-500 transition hover:bg-primary-50"
                          aria-label="Edit"
                        >
                          <PenLine size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
