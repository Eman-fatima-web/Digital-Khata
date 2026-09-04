import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'
import { randomUUID, createHash } from 'crypto'
import { createChildLogger } from './logger.js'

const log = createChildLogger({ module: 'local-auth' })

type LocalUser = {
  id: string
  email: string
  passwordHash: string
  businessId: string
  businessName: string
  fullName?: string
  phone?: string
  address?: string
  shopName?: string
  cnic?: string
  emailVerified: boolean
  verificationToken?: string
  verificationTokenExpiry?: string
  passwordResetToken?: string
  passwordResetTokenExpiry?: string
  createdAt: string
}

type LocalAuthStore = {
  users: LocalUser[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE_PATH = resolve(__dirname, '../.local-auth.json')

function loadStore(): LocalAuthStore {
  try {
    if (existsSync(STORE_PATH)) {
      const raw = readFileSync(STORE_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    log.warn({ err }, 'Failed to read local auth store, starting fresh')
  }
  return { users: [] }
}

function saveStore(store: LocalAuthStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export function findUserByEmail(email: string): LocalUser | undefined {
  const store = loadStore()
  const normalized = email.trim().toLowerCase()
  return store.users.find((u) => u.email.trim().toLowerCase() === normalized)
}

export async function createUser(
  email: string,
  password: string,
  businessName: string
): Promise<LocalUser> {
  const store = loadStore()
  const passwordHash = await bcrypt.hash(password, 10)
  const user: LocalUser = {
    id: randomUUID(),
    email,
    passwordHash,
    businessId: randomUUID(),
    businessName,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  }
  store.users.push(user)
  saveStore(store)
  log.info({ email, userId: user.id }, 'Local auth: user registered')
  return user
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export async function verifyLocalPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export function findUserById(id: string): LocalUser | undefined {
  const store = loadStore()
  return store.users.find((u) => u.id === id)
}

export function setVerificationToken(userId: string, token: string, expiry: string): void {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  user.verificationToken = createHash('sha256').update(token).digest('hex')
  user.verificationTokenExpiry = expiry
  saveStore(store)
}

export function verifyEmailToken(userId: string, token: string): boolean {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user || !user.verificationToken || !user.verificationTokenExpiry) return false
  if (new Date(user.verificationTokenExpiry) < new Date()) return false
  const hashedToken = createHash('sha256').update(token).digest('hex')
  if (hashedToken !== user.verificationToken) return false
  user.emailVerified = true
  delete user.verificationToken
  delete user.verificationTokenExpiry
  saveStore(store)
  return true
}

export function setResetToken(userId: string, token: string, expiry: string): void {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  user.passwordResetToken = createHash('sha256').update(token).digest('hex')
  user.passwordResetTokenExpiry = expiry
  saveStore(store)
}

export async function resetPasswordWithToken(
  userId: string,
  token: string,
  newPassword: string
): Promise<boolean> {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user || !user.passwordResetToken || !user.passwordResetTokenExpiry) return false
  if (new Date(user.passwordResetTokenExpiry) < new Date()) return false
  const hashedToken = createHash('sha256').update(token).digest('hex')
  if (hashedToken !== user.passwordResetToken) return false
  user.passwordHash = await bcrypt.hash(newPassword, 10)
  delete user.passwordResetToken
  delete user.passwordResetTokenExpiry
  saveStore(store)
  return true
}

export function setPasswordHash(userId: string, passwordHash: string): void {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  user.passwordHash = passwordHash
  saveStore(store)
}

export function updateUserProfile(
  userId: string,
  fields: Partial<Pick<LocalUser, 'fullName' | 'phone' | 'address' | 'shopName' | 'cnic'>>,
): LocalUser | undefined {
  const store = loadStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) return undefined
  if (fields.fullName !== undefined) user.fullName = fields.fullName
  if (fields.phone !== undefined) user.phone = fields.phone
  if (fields.address !== undefined) user.address = fields.address
  if (fields.shopName !== undefined) user.shopName = fields.shopName
  if (fields.cnic !== undefined) user.cnic = fields.cnic
  saveStore(store)
  return user
}
