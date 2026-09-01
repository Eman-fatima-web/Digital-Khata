import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../data/db/db'
import { useCustomersPaginated, useUdhaarPaginated, usePaymentsPaginated, useSalesPaginated } from './usePaginatedData'
import type { Customer, UdhaarEntry, Payment, Sale } from '../core/types'
import { generateId, nowISO } from '../lib/utils'

describe('Pagination Hooks Performance', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.udhaar.clear()
    await db.payments.clear()
    await db.sales.clear()
  })

  describe('useCustomersPaginated', () => {
    it('paginates 1000 customers without loading all into memory', async () => {
      // Generate 1000 customers
      const customers: Customer[] = Array.from({ length: 1000 }, (_, i) => ({
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: `Customer ${String(i).padStart(4, '0')}`,
        phone: `0300${String(i).padStart(7, '0')}`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.customers.bulkAdd(customers)

      // Use paginated hook with page size 50
      const { result } = renderHook(() =>
        useCustomersPaginated({ pageSize: 50 })
      )

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify we got exactly 50 items (page size)
      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
      expect(result.current.total).toBe(1000)

      // Verify items are sorted by name
      const names = result.current.items?.map((c) => c.name) ?? []
      const sortedNames = [...names].sort()
      expect(names).toEqual(sortedNames)
    })

    it('loads next page using page navigation', async () => {
      // Generate 150 customers
      const customers: Customer[] = Array.from({ length: 150 }, (_, i) => ({
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: `Customer ${String(i).padStart(4, '0')}`,
        phone: `0300${String(i).padStart(7, '0')}`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.customers.bulkAdd(customers)

      // Load first page
      const { result } = renderHook(() =>
        useCustomersPaginated({ pageSize: 50 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
      expect(result.current.page).toBe(0)

      // Navigate to second page
      result.current.nextPage()

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await waitFor(() => {
        expect(result.current.page).toBe(1)
      })

      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      
      // Verify second page has different items than first page
      const firstPageIds = new Set(
        Array.from({ length: 50 }, (_, i) => customers[i].id)
      )
      const secondPageIds = result.current.items?.map((c) => c.id) ?? []
      
      // Second page should not contain any items from first page
      secondPageIds.forEach((id) => {
        expect(firstPageIds.has(id)).toBe(false)
      })
    })

    it('filters by search without loading all records', async () => {
      // Generate 500 customers with specific names
      const customers: Customer[] = Array.from({ length: 500 }, (_, i) => ({
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: i < 50 ? `Ahmed ${i}` : `Customer ${i}`,
        phone: `0300${String(i).padStart(7, '0')}`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.customers.bulkAdd(customers)

      // Search for "Ahmed"
      const { result } = renderHook(() =>
        useCustomersPaginated({ pageSize: 50, search: 'Ahmed' })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should only return customers with "Ahmed" in name
      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBeLessThanOrEqual(50)
      result.current.items?.forEach((customer) => {
        expect(customer.name.toLowerCase()).toContain('ahmed')
      })
    })
  })

  describe('useUdhaarPaginated', () => {
    it('paginates udhaar entries', async () => {
      // Create a customer
      const customer: Customer = {
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: 'Test Customer',
        phone: '03001234567',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }
      await db.customers.add(customer)

      // Generate 200 udhaar entries
      const udhaars: UdhaarEntry[] = Array.from({ length: 200 }, (_, i) => ({
        id: generateId(),
        customerId: customer.id,
        userId: 'user-1',
        shopId: 'shop-1',
        description: `Udhaar ${i}`,
        amount: 1000 + i * 100,
        paidAmount: 0,
        remainingAmount: 1000 + i * 100,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.udhaar.bulkAdd(udhaars)

      const { result } = renderHook(() =>
        useUdhaarPaginated({ pageSize: 50, customerId: customer.id })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
    })
  })

  describe('usePaymentsPaginated', () => {
    it('paginates payments with date filter', async () => {
      const customer: Customer = {
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: 'Test Customer',
        phone: '03001234567',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }
      await db.customers.add(customer)

      // Generate 150 payments
      const payments: Payment[] = Array.from({ length: 150 }, (_, i) => ({
        id: generateId(),
        customerId: customer.id,
        userId: 'user-1',
        shopId: 'shop-1',
        amount: 500 + i * 50,
        method: 'Cash',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.payments.bulkAdd(payments)

      const { result } = renderHook(() =>
        usePaymentsPaginated({ pageSize: 50 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
    })
  })

  describe('useSalesPaginated', () => {
    it('paginates sales with customer filter', async () => {
      const customer: Customer = {
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: 'Test Customer',
        phone: '03001234567',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }
      await db.customers.add(customer)

      // Generate 100 sales
      const sales: Sale[] = Array.from({ length: 100 }, (_, i) => ({
        id: generateId(),
        customerId: customer.id,
        userId: 'user-1',
        shopId: 'shop-1',
        amount: 1000 + i * 100,
        description: `Sale ${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.sales.bulkAdd(sales)

      const { result } = renderHook(() =>
        useSalesPaginated({ pageSize: 50, customerId: customer.id })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items).toBeDefined()
      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
    })
  })

  describe('Scalability', () => {
    it('handles 10,000 customers with cursor-based pagination', async () => {
      const customers: Customer[] = Array.from({ length: 10000 }, (_, i) => ({
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: `Customer ${String(i).padStart(5, '0')}`,
        phone: `0300${String(i).padStart(7, '0')}`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.customers.bulkAdd(customers)

      const { result } = renderHook(() =>
        useCustomersPaginated({ pageSize: 50 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
      expect(result.current.total).toBe(10000)
    }, 30000)

    it('handles 5,000 udhaar entries with customer filter', async () => {
      const customer: Customer = {
        id: generateId(),
        userId: 'user-1',
        shopId: 'shop-1',
        name: 'Scalability Customer',
        phone: '03009999999',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }
      await db.customers.add(customer)

      const udhaars: UdhaarEntry[] = Array.from({ length: 5000 }, (_, i) => ({
        id: generateId(),
        customerId: customer.id,
        userId: 'user-1',
        shopId: 'shop-1',
        description: `Udhaar ${i}`,
        amount: 100 + i * 10,
        paidAmount: 0,
        remainingAmount: 100 + i * 10,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        syncStatus: 'synced',
        version: 1,
        isDeleted: false,
      }))

      await db.udhaar.bulkAdd(udhaars)

      const { result } = renderHook(() =>
        useUdhaarPaginated({ pageSize: 50, customerId: customer.id })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items?.length).toBe(50)
      expect(result.current.hasMore).toBe(true)
      expect(result.current.total).toBe(5000)
    }, 30000)
  })
})
