import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSavedProducts,
  saveProducts,
  updateProduct,
  deleteProduct,
  decrementProductStock,
} from './savedProducts'

const SHOP = 'shop-stock-test'

describe('savedProducts stock', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves a product and preserves stock on later upsert', () => {
    const first = saveProducts(SHOP, [{ name: 'Rice', rate: 150 }])
    const firstId = first[0].id
    updateProduct(SHOP, firstId, { stock: 20 })

    const reUpserted = saveProducts(SHOP, [{ name: 'rice', rate: 160 }])
    expect(reUpserted).toHaveLength(1)
    expect(reUpserted[0].id).toBe(firstId)
    expect(reUpserted[0].rate).toBe(160)
    expect(reUpserted[0].stock).toBe(20)
  })

  it('updates stock via updateProduct', () => {
    const [p] = saveProducts(SHOP, [{ name: 'Oil', rate: 500 }])
    const next = updateProduct(SHOP, p.id, { stock: 8 })
    expect(next[0].stock).toBe(8)
  })

  it('updates and preserves cost via updateProduct', () => {
    const [p] = saveProducts(SHOP, [{ name: 'Ghee', rate: 800 }])
    updateProduct(SHOP, p.id, { cost: 650 })
    const reUpserted = saveProducts(SHOP, [{ name: 'ghee', rate: 820 }])
    expect(reUpserted[0].cost).toBe(650)
    const updated = updateProduct(SHOP, p.id, { cost: 700 })
    expect(updated[0].cost).toBe(700)
  })

  it('decrements stock by qty and floors at zero', () => {
    const [p] = saveProducts(SHOP, [{ name: 'Sugar', rate: 120 }])
    updateProduct(SHOP, p.id, { stock: 10 })
    decrementProductStock(SHOP, [{ name: 'sugar', qty: 4 }])
    expect(getSavedProducts(SHOP)[0].stock).toBe(6)
    decrementProductStock(SHOP, [{ name: 'SUGAR', qty: 100 }])
    expect(getSavedProducts(SHOP)[0].stock).toBe(0)
  })

  it('does not decrement products without stock set', () => {
    saveProducts(SHOP, [{ name: 'Tea', rate: 300 }])
    const before = getSavedProducts(SHOP)
    decrementProductStock(SHOP, [{ name: 'Tea', qty: 5 }])
    const after = getSavedProducts(SHOP)
    expect(after).toEqual(before)
    expect(after[0].stock).toBeUndefined()
  })

  it('deletes a product', () => {
    const [p] = saveProducts(SHOP, [{ name: 'Flour', rate: 90 }])
    const next = deleteProduct(SHOP, p.id)
    expect(next).toHaveLength(0)
  })
})
