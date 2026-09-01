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
  emailVerified: boolean
  verificationToken?: string
  verificationTokenExpiry?: string
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
  return store.users.find((u) => u.email === email)
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
