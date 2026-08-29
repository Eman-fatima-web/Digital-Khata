import { migrateLegacyData } from './migrations'
import { seedDatabase } from './seed'

export async function initializeDatabase(): Promise<void> {
  const migrated = await migrateLegacyData()
  if (!migrated) {
    await seedDatabase()
  }
}
