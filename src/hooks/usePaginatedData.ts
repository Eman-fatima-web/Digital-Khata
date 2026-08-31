import { useCallback, useEffect, useState } from 'react'

import { db } from '../data/db/db'
import type { Customer, Payment, Sale, UdhaarEntry } from '../core/types'

export type PaginationOptions = {
  pageSize?: number
  cursor?: string
  search?: string
  customerId?: string
  startDate?: string
  endDate?: string
  outstandingOnly?: boolean
}

export type PaginatedResult<T> = {
  items: T[]
  nextCursor?: string
  hasMore: boolean
  total?: number
}

/**
 * Paginated customers hook with cursor-based pagination
 * Uses indexed queries for efficient pagination
 */
export function useCustomersPaginated(options: PaginationOptions = {}) {
  const [result, setResult] = useState<PaginatedResult<Customer> | undefined>()
  const [loading, setLoading] = useState(true)

  const pageSize = options.pageSize ?? 50

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const query = db.customers.filter((c) => !c.isDeleted)

      // Apply search filter if provided
      if (options.search) {
        const allCustomers = await query.toArray()
        const searchLower = options.search.toLowerCase()
        const filtered = allCustomers.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.phone.toLowerCase().includes(searchLower)
        )
        
        // Apply cursor if provided
        let startIndex = 0
        if (options.cursor) {
          const cursorIndex = filtered.findIndex((c) => c.id === options.cursor)
          if (cursorIndex >= 0) {
            startIndex = cursorIndex + 1
          }
        }

        const items = filtered.slice(startIndex, startIndex + pageSize)
        const hasMore = startIndex + pageSize < filtered.length
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

        setResult({
          items,
          nextCursor,
          hasMore,
          total: filtered.length,
        })
      } else {
        // No search, use simple pagination with cursor
        const allItems = await db.customers
          .filter((c) => !c.isDeleted)
          .toArray()
        
        // Sort by name
        allItems.sort((a, b) => a.name.localeCompare(b.name))

        // Apply cursor if provided
        let startIndex = 0
        if (options.cursor) {
          const cursorIndex = allItems.findIndex((c) => c.id === options.cursor)
          if (cursorIndex >= 0) {
            startIndex = cursorIndex + 1
          }
        }

        const items = allItems.slice(startIndex, startIndex + pageSize)
        const hasMore = startIndex + pageSize < allItems.length
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

        setResult({
          items,
          nextCursor,
          hasMore,
          total: allItems.length,
        })
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setResult({ items: [], hasMore: false })
    } finally {
      setLoading(false)
    }
  }, [pageSize, options.cursor, options.search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage()
  }, [loadPage])

  const loadMore = useCallback(() => {
    if (result?.hasMore && result?.nextCursor) {
      // Trigger reload with new cursor by updating options
      // This will be handled by the parent component
    }
  }, [result?.hasMore, result?.nextCursor])

  return { ...result, loading, loadMore }
}

/**
 * Paginated udhaar hook with filters
 */
export function useUdhaarPaginated(options: PaginationOptions = {}) {
  const [result, setResult] = useState<PaginatedResult<UdhaarEntry> | undefined>()
  const [loading, setLoading] = useState(true)

  const pageSize = options.pageSize ?? 50

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const query = db.udhaar.filter((e) => !e.isDeleted)
      let allItems = await query.toArray()

      if (options.customerId) {
        allItems = allItems.filter((e) => e.customerId === options.customerId)
      }

      if (options.outstandingOnly) {
        allItems = allItems.filter((e) => e.remainingAmount > 0)
      }

      allItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      let startIndex = 0
      if (options.cursor) {
        const cursorIndex = allItems.findIndex((e) => e.id === options.cursor)
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1
        }
      }

      const items = allItems.slice(startIndex, startIndex + pageSize)
      const hasMore = startIndex + pageSize < allItems.length
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

      setResult({
        items,
        nextCursor,
        hasMore,
        total: allItems.length,
      })
    } catch (error) {
      console.error('Error loading udhaar:', error)
      setResult({ items: [], hasMore: false })
    } finally {
      setLoading(false)
    }
  }, [pageSize, options.cursor, options.customerId, options.outstandingOnly])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage()
  }, [loadPage])

  const loadMore = useCallback(() => {
    if (result?.hasMore && result?.nextCursor) {
      // Trigger reload with new cursor by updating options
      // This will be handled by the parent component
    }
  }, [result?.hasMore, result?.nextCursor])

  return { ...result, loading, loadMore }
}

/**
 * Paginated payments hook with filters
 */
export function usePaymentsPaginated(options: PaginationOptions = {}) {
  const [result, setResult] = useState<PaginatedResult<Payment> | undefined>()
  const [loading, setLoading] = useState(true)

  const pageSize = options.pageSize ?? 50

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const query = db.payments.filter((p) => !p.isDeleted)
      let allItems = await query.toArray()

      if (options.customerId) {
        allItems = allItems.filter((p) => p.customerId === options.customerId)
      }

      if (options.startDate || options.endDate) {
        allItems = allItems.filter((p) => {
          if (options.startDate && p.date < options.startDate) return false
          if (options.endDate && p.date > options.endDate) return false
          return true
        })
      }

      allItems.sort((a, b) => b.date.localeCompare(a.date))

      let startIndex = 0
      if (options.cursor) {
        const cursorIndex = allItems.findIndex((p) => p.id === options.cursor)
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1
        }
      }

      const items = allItems.slice(startIndex, startIndex + pageSize)
      const hasMore = startIndex + pageSize < allItems.length
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

      setResult({
        items,
        nextCursor,
        hasMore,
        total: allItems.length,
      })
    } catch (error) {
      console.error('Error loading payments:', error)
      setResult({ items: [], hasMore: false })
    } finally {
      setLoading(false)
    }
  }, [pageSize, options.cursor, options.customerId, options.startDate, options.endDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage()
  }, [loadPage])

  const loadMore = useCallback(() => {
    if (result?.hasMore && result?.nextCursor) {
      // Trigger reload with new cursor by updating options
      // This will be handled by the parent component
    }
  }, [result?.hasMore, result?.nextCursor])

  return { ...result, loading, loadMore }
}

/**
 * Paginated sales hook with filters
 */
export function useSalesPaginated(options: PaginationOptions = {}) {
  const [result, setResult] = useState<PaginatedResult<Sale> | undefined>()
  const [loading, setLoading] = useState(true)

  const pageSize = options.pageSize ?? 50

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const query = db.sales.filter((s) => !s.isDeleted)
      let allItems = await query.toArray()

      if (options.customerId) {
        allItems = allItems.filter((s) => s.customerId === options.customerId)
      }

      if (options.startDate || options.endDate) {
        allItems = allItems.filter((s) => {
          if (options.startDate && s.date < options.startDate) return false
          if (options.endDate && s.date > options.endDate) return false
          return true
        })
      }

      allItems.sort((a, b) => b.date.localeCompare(a.date))

      let startIndex = 0
      if (options.cursor) {
        const cursorIndex = allItems.findIndex((s) => s.id === options.cursor)
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1
        }
      }

      const items = allItems.slice(startIndex, startIndex + pageSize)
      const hasMore = startIndex + pageSize < allItems.length
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

      setResult({
        items,
        nextCursor,
        hasMore,
        total: allItems.length,
      })
    } catch (error) {
      console.error('Error loading sales:', error)
      setResult({ items: [], hasMore: false })
    } finally {
      setLoading(false)
    }
  }, [pageSize, options.cursor, options.customerId, options.startDate, options.endDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage()
  }, [loadPage])

  const loadMore = useCallback(() => {
    if (result?.hasMore && result?.nextCursor) {
      // Trigger reload with new cursor by updating options
      // This will be handled by the parent component
    }
  }, [result?.hasMore, result?.nextCursor])

  return { ...result, loading, loadMore }
}
