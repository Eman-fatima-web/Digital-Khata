import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') })
