import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { createChildLogger } from '../services/logger.js'
import * as customerRepo from '../repositories/customerRepository.js'
import * as udhaarRepo from '../repositories/udhaarRepository.js'
import * as paymentRepo from '../repositories/paymentRepository.js'
import * as saleRepo from '../repositories/saleRepository.js'

const log = createChildLogger({ module: 'data' })

export const dataRouter = Router()
dataRouter.use(authenticateToken)

function parsePagination(query: Record<string, unknown>) {
  const limit = query.limit ? Math.min(Number(query.limit), 200) : 50
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined
  return { limit, cursor }
}

dataRouter.get('/customers', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const search = typeof req.query.search === 'string' ? req.query.search : undefined

    const result = await customerRepo.getAllCustomers(businessId, { limit, cursor, search })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List customers error')
    res.status(500).json({ error: 'Failed to fetch customers' })
  }
})

dataRouter.get('/customers/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const customer = await customerRepo.getCustomerById(businessId, req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    log.error({ err: error }, 'Get customer error')
    res.status(500).json({ error: 'Failed to fetch customer' })
  }
})

dataRouter.get('/udhaar', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined

    const result = await udhaarRepo.getAllUdhaar(businessId, { limit, cursor, customerId })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List udhaar error')
    res.status(500).json({ error: 'Failed to fetch udhaar entries' })
  }
})

dataRouter.get('/payments', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined

    const result = await paymentRepo.getAllPayments(businessId, { limit, cursor, customerId, startDate, endDate })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List payments error')
    res.status(500).json({ error: 'Failed to fetch payments' })
  }
})

dataRouter.get('/sales', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined

    const result = await saleRepo.getAllSales(businessId, { limit, cursor, customerId, startDate, endDate })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List sales error')
    res.status(500).json({ error: 'Failed to fetch sales' })
  }
})

// Deleted items endpoints
dataRouter.get('/deleted/customers', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const result = await customerRepo.getDeletedCustomers(businessId, { limit, cursor })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List deleted customers error')
    res.status(500).json({ error: 'Failed to fetch deleted customers' })
  }
})

dataRouter.get('/deleted/sales', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const result = await saleRepo.getDeletedSales(businessId, { limit, cursor })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List deleted sales error')
    res.status(500).json({ error: 'Failed to fetch deleted sales' })
  }
})

dataRouter.get('/deleted/payments', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const result = await paymentRepo.getDeletedPayments(businessId, { limit, cursor })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List deleted payments error')
    res.status(500).json({ error: 'Failed to fetch deleted payments' })
  }
})

dataRouter.get('/deleted/udhaar', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>)
    const result = await udhaarRepo.getDeletedUdhaar(businessId, { limit, cursor })
    res.json(result)
  } catch (error) {
    log.error({ err: error }, 'List deleted udhaar error')
    res.status(500).json({ error: 'Failed to fetch deleted udhaar entries' })
  }
})

// Restore endpoints
dataRouter.post('/restore/customers/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const restored = await customerRepo.restoreCustomer(businessId, req.params.id)
    if (!restored) return res.status(404).json({ error: 'Customer not found' })
    log.info({ customerId: req.params.id }, 'Customer restored')
    res.json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Restore customer error')
    res.status(500).json({ error: 'Failed to restore customer' })
  }
})

dataRouter.post('/restore/sales/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const restored = await saleRepo.restoreSale(businessId, req.params.id)
    if (!restored) return res.status(404).json({ error: 'Sale not found' })
    log.info({ saleId: req.params.id }, 'Sale restored')
    res.json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Restore sale error')
    res.status(500).json({ error: 'Failed to restore sale' })
  }
})

dataRouter.post('/restore/payments/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const restored = await paymentRepo.restorePayment(businessId, req.params.id)
    if (!restored) return res.status(404).json({ error: 'Payment not found' })
    log.info({ paymentId: req.params.id }, 'Payment restored')
    res.json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Restore payment error')
    res.status(500).json({ error: 'Failed to restore payment' })
  }
})

dataRouter.post('/restore/udhaar/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.businessId!
    const restored = await udhaarRepo.restoreUdhaar(businessId, req.params.id)
    if (!restored) return res.status(404).json({ error: 'Udhaar entry not found' })
    log.info({ udhaarId: req.params.id }, 'Udhaar entry restored')
    res.json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Restore udhaar error')
    res.status(500).json({ error: 'Failed to restore udhaar entry' })
  }
})
