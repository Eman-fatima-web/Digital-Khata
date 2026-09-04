import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { config } from 'dotenv'

const currentDir = dirname(fileURLToPath(import.meta.url))
const possiblePaths = [
  resolve(currentDir, '.env'),
  resolve(currentDir, '../.env'),
  resolve(process.cwd(), 'server/.env'),
  resolve(process.cwd(), '.env'),
]

for (const p of possiblePaths) {
  if (existsSync(p)) {
    config({ path: p })
  }
}
