import { STORAGE_KEYS } from '../../core/config/constants'
import { generateId } from '../../lib/utils'

export type SavedProduct = {
  id: string
  name: string
  rate: number
  stock?: number
  cost?: number
}

const listeners = new Set<() => void>()

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function notify() {
  listeners.forEach((fn) => fn())
}

function storageKey(shopId: string): string {
  return `${STORAGE_KEYS.SAVED_PRODUCTS}:${shopId}`
}

export function getSavedProducts(shopId: string): SavedProduct[] {
  try {
    const raw = localStorage.getItem(storageKey(shopId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(shopId: string, products: SavedProduct[]) {
  try {
    localStorage.setItem(storageKey(shopId), JSON.stringify(products))
  } catch {
    // storage full or unavailable — ignore, in-memory list still used this session
  }
  notify()
}

/**
 * Upsert one or more products keyed by name. Later rates win for matching names.
 */
export function saveProducts(shopId: string, items: { name: string; rate: number }[]): SavedProduct[] {
  const current = getSavedProducts(shopId)
  const byName = new Map(current.map((p) => [p.name.toLowerCase().trim(), p]))
  for (const item of items) {
    const name = item.name.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const existing = byName.get(key)
    const product: SavedProduct = {
      id: existing?.id ?? generateId(),
      name: existing?.name ?? name,
      rate: item.rate > 0 ? item.rate : (existing?.rate ?? 0),
      stock: existing?.stock,
      cost: existing?.cost,
    }
    byName.set(key, product)
  }
  const next = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  persist(shopId, next)
  return next
}

export function deleteProduct(shopId: string, id: string): SavedProduct[] {
  const next = getSavedProducts(shopId).filter((p) => p.id !== id)
  persist(shopId, next)
  return next
}

export function updateProduct(
  shopId: string,
  id: string,
  patch: { name?: string; rate?: number; stock?: number; cost?: number },
): SavedProduct[] {
  const current = getSavedProducts(shopId)
  const index = current.findIndex((p) => p.id === id)
  if (index === -1) return current
  const next = [...current]
  next[index] = {
    ...next[index],
    name: patch.name?.trim() && patch.name.trim().length > 0 ? patch.name!.trim() : next[index].name,
    rate: patch.rate !== undefined && patch.rate > 0 ? patch.rate : (patch.rate === 0 ? 0 : next[index].rate),
    stock: patch.stock !== undefined ? Math.max(0, patch.stock) : next[index].stock,
    cost: patch.cost !== undefined ? Math.max(0, patch.cost) : next[index].cost,
  }
  next.sort((a, b) => a.name.localeCompare(b.name))
  persist(shopId, next)
  return next
}

/**
 * Reduce stock for named products by qty (floor at 0). Returns whether any
 * saved product matched. Used when a sale removes items from inventory.
 */
export function decrementProductStock(shopId: string, items: { name: string; qty: number }[]): SavedProduct[] {
  const current = getSavedProducts(shopId)
  const byKey = new Map(current.map((p) => [p.name.toLowerCase().trim(), p]))
  let changed = false
  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    const product = byKey.get(key)
    if (!product || product.stock === undefined) continue
    const nextStock = Math.max(0, (product.stock || 0) - Math.floor(item.qty || 0))
    if (nextStock !== product.stock) {
      product.stock = nextStock
      changed = true
    }
  }
  if (!changed) return current
  const next = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name))
  persist(shopId, next)
  return next
}

export function subscribeToProducts(fn: () => void): () => void {
  return subscribe(fn)
}
