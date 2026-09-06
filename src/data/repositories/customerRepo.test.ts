import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db/db'
import {
  addCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  updateCustomer,
} from './customerRepo'

const owner = { userId: 'user-1', shopId: 'shop-1' }

describe('customerRepo', () => {
  beforeEach(async () => {
    await db.customers.clear()
    await db.syncQueue.clear()
  })

  it('adds a customer with correct metadata', async () => {
    const customer = await addCustomer({ name: 'Ahmed', phone: '03001234567' }, owner)
    expect(customer.name).toBe('Ahmed')
    expect(customer.userId).toBe('user-1')
    expect(customer.shopId).toBe('shop-1')
    expect(customer.syncStatus).toBe('pending')
    expect(customer.version).toBe(1)
    expect(customer.id).toBeTruthy()
  })

  it('retrieves customer by id', async () => {
    const created = await addCustomer({ name: 'Sara', phone: '03112223344' }, owner)
    const found = await getCustomerById(created.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Sara')
  })

  it('returns undefined for non-existent id', async () => {
    const found = await getCustomerById('non-existent')
    expect(found).toBeUndefined()
  })

  it('gets all non-deleted customers sorted by name', async () => {
    await addCustomer({ name: 'Zain', phone: '03001111111' }, owner)
    await addCustomer({ name: 'Ahmed', phone: '03002222222' }, owner)
    await addCustomer({ name: 'Sara', phone: '03003333333' }, owner)

    const all = await getAllCustomers()
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Ahmed')
    expect(all[1].name).toBe('Sara')
    expect(all[2].name).toBe('Zain')
  })

  it('excludes deleted customers from getAllCustomers', async () => {
    const c1 = await addCustomer({ name: 'Ahmed', phone: '03001111111' }, owner)
    await addCustomer({ name: 'Sara', phone: '03002222222' }, owner)
    await deleteCustomer(c1.id)

    const all = await getAllCustomers()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Sara')
  })

  it('updates customer fields and increments version', async () => {
    const customer = await addCustomer({ name: 'Ahmed', phone: '03001234567' }, owner)
    await updateCustomer(customer.id, { name: 'Ahmed Khan' })

    const updated = await getCustomerById(customer.id)
    expect(updated!.name).toBe('Ahmed Khan')
    expect(updated!.version).toBe(2)
    expect(updated!.syncStatus).toBe('pending')
  })

  it('throws when updating non-existent customer', async () => {
    await expect(updateCustomer('non-existent', { name: 'X' })).rejects.toThrow('not found')
  })

  it('soft-deletes customer (sets isDeleted)', async () => {
    const customer = await addCustomer({ name: 'Ahmed', phone: '03001234567' }, owner)
    await deleteCustomer(customer.id)

    const deleted = await getCustomerById(customer.id)
    expect(deleted!.isDeleted).toBe(true)
    expect(deleted!.version).toBe(2)
  })

  it('throws when deleting non-existent customer', async () => {
    await expect(deleteCustomer('non-existent')).rejects.toThrow('not found')
  })

  it('searches customers by name (case-insensitive)', async () => {
    await addCustomer({ name: 'Ahmed Khan', phone: '03001111111' }, owner)
    await addCustomer({ name: 'Sara Ali', phone: '03002222222' }, owner)

    const results = await searchCustomers('ahmed')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Ahmed Khan')
  })

  it('searches customers by phone', async () => {
    await addCustomer({ name: 'Ahmed', phone: '03001234567' }, owner)
    await addCustomer({ name: 'Sara', phone: '03119998877' }, owner)

    const results = await searchCustomers('0311')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Sara')
  })

  it('excludes deleted customers from search', async () => {
    const c1 = await addCustomer({ name: 'Ahmed', phone: '03001111111' }, owner)
    await addCustomer({ name: 'Ahmed Khan', phone: '03002222222' }, owner)
    await deleteCustomer(c1.id)

    const results = await searchCustomers('Ahmed')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Ahmed Khan')
  })

  it('enqueues sync action on create', async () => {
    await addCustomer({ name: 'Ahmed', phone: '03001234567' }, owner)
    const queue = await db.syncQueue.toArray()
    expect(queue.length).toBeGreaterThanOrEqual(1)
    expect(queue[0].table).toBe('customers')
    expect(queue[0].operation).toBe('create')
  })
})
