import { describe, expect, it } from 'vitest'
import { downloadProductsPdf } from '../lib/pdf'

describe('downloadProductsPdf runtime', () => {
  it('generates a valid PDF for products and profit data without throwing', () => {
    expect(() =>
      downloadProductsPdf({
        generatedLabel: '2026-09-04',
        totalProducts: 3,
        totalStock: 45,
        lowStock: 1,
        totalInvestment: 10000,
        stockValue: 18000,
        potentialProfit: 8000,
        soldRevenue: 5000,
        soldCost: 3500,
        soldProfit: 1500,
        stockOnlyProducts: 1,
        products: [
          { name: 'Sugar', rate: 130, cost: 100, stock: 40, margin: 30 },
          { name: 'Oil', rate: 550, cost: 470, margin: 17 },
          { name: 'Tea', rate: 900, cost: 850, stock: 5, margin: 6 },
        ],
      }),
    ).not.toThrow()
  })

  it('works when there are many products (multi-page)', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      name: `Product ${i}`,
      rate: 100 + i,
      cost: 80 + i,
      stock: i,
      margin: 20,
    }))
    expect(() =>
      downloadProductsPdf({
        generatedLabel: '2026-09-04',
        totalProducts: many.length,
        totalStock: 100,
        lowStock: 2,
        totalInvestment: 5000,
        stockValue: 6000,
        potentialProfit: 1000,
        soldRevenue: 0,
        soldCost: 0,
        soldProfit: 0,
        stockOnlyProducts: 0,
        products: many,
      }),
    ).not.toThrow()
  })
})
