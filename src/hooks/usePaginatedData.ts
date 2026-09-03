import { useEffect, useState } from 'react'

import { db } from '../data/db/db'
import type { Customer, Payment, Sale, UdhaarEntry } from '../core/types'

export type PaginationOptions = {
  pageSize?: number
  search?: string
  customerId?: string
  startDate?: string
  endDate?: string
  outstandingOnly?: boolean
}

export type PaginatedResult<T> = {
  items: T[]
  hasMore: boolean
  total: number
  page: number
}

export type PaginatedHookReturn<T> = PaginatedResult<T> & {
  loading: boolean
  page: number
  setPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
}

function usePaginatedQuery<T>(
  queryFn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  deps: unknown[],
  pageSize: number,
): PaginatedHookReturn<T> {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<PaginatedResult<T>>({ items: [], hasMore: false, total: 0, page: 0 })
  const [loading, setLoading] = useState(true)

  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    void queryFn(page, pageSize).then(({ items, total }) => {
      if (!cancelled) {
        setResult({ items, hasMore: (page + 1) * pageSize < total, total, page })
      }
    }).catch(() => {
      if (!cancelled) {
        setResult({ items: [], hasMore: false, total: 0, page })
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, depsKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
  }, [depsKey])

  return {
    ...result,
    loading,
    page,
    setPage,
    nextPage: () => setPage((p) => p + 1),
    previousPage: () => setPage((p) => Math.max(0, p - 1)),
  }
}

export function useCustomersPaginated(options: PaginationOptions = {}): PaginatedHookReturn<Customer> {
  const pageSize = options.pageSize ?? 50
  const search = options.search ?? ''

  return usePaginatedQuery<Customer>(
    async (page, size) => {
      const buildQuery = () =>
        db.customers
          .orderBy('name')
          .filter((c) => {
            if (c.isDeleted) return false
            if (!search) return true
            const q = search.toLowerCase()
            return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
          })

      const total = await buildQuery().count()
      const items = await buildQuery().offset(page * size).limit(size).toArray()
      return { items, total }
    },
    [search],
    pageSize,
  )
}

export function useUdhaarPaginated(options: PaginationOptions = {}): PaginatedHookReturn<UdhaarEntry> {
  const pageSize = options.pageSize ?? 50
  const customerId = options.customerId ?? ''
  const outstandingOnly = options.outstandingOnly ?? false

  return usePaginatedQuery<UdhaarEntry>(
    async (page, size) => {
      const buildQuery = () =>
        db.udhaar
          .orderBy('createdAt')
          .reverse()
          .filter((e) => {
            if (e.isDeleted) return false
            if (customerId && e.customerId !== customerId) return false
            if (outstandingOnly && e.remainingAmount <= 0) return false
            return true
          })

      const total = await buildQuery().count()
      const items = await buildQuery().offset(page * size).limit(size).toArray()
      return { items, total }
    },
    [customerId, outstandingOnly],
    pageSize,
  )
}

export function usePaymentsPaginated(options: PaginationOptions = {}): PaginatedHookReturn<Payment> {
  const pageSize = options.pageSize ?? 50
  const customerId = options.customerId ?? ''
  const startDate = options.startDate ?? ''
  const endDate = options.endDate ?? ''

  return usePaginatedQuery<Payment>(
    async (page, size) => {
      const buildQuery = () =>
        db.payments
          .orderBy('date')
          .reverse()
          .filter((p) => {
            if (p.isDeleted) return false
            if (customerId && p.customerId !== customerId) return false
            if (startDate && p.date < startDate) return false
            if (endDate && p.date > endDate) return false
            return true
          })

      const total = await buildQuery().count()
      const items = await buildQuery().offset(page * size).limit(size).toArray()
      return { items, total }
    },
    [customerId, startDate, endDate],
    pageSize,
  )
}

export function useSalesPaginated(options: PaginationOptions = {}): PaginatedHookReturn<Sale> {
  const pageSize = options.pageSize ?? 50
  const customerId = options.customerId ?? ''
  const startDate = options.startDate ?? ''
  const endDate = options.endDate ?? ''

  return usePaginatedQuery<Sale>(
    async (page, size) => {
      const buildQuery = () =>
        db.sales
          .orderBy('date')
          .reverse()
          .filter((s) => {
            if (s.isDeleted) return false
            if (customerId && s.customerId !== customerId) return false
            if (startDate && s.date < startDate) return false
            if (endDate && s.date > endDate) return false
            return true
          })

      const total = await buildQuery().count()
      const items = await buildQuery().offset(page * size).limit(size).toArray()
      return { items, total }
    },
    [customerId, startDate, endDate],
    pageSize,
  )
}
