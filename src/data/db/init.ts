import { loadAuthTokens } from '../../services/api'
import { migrateLegacyData } from './migrations'

export async function initializeDatabase(): Promise<void> {
  // New accounts must start empty. Legacy localStorage data (if any) is only
  // migrated when we know the authenticated owner, so it is tagged with the
  // real tenant and is never hidden under a fake identity.
  const tokens = loadAuthTokens()
  if (!tokens?.user) {
    return
  }
  await migrateLegacyData({ userId: tokens.user.id, shopId: tokens.user.businessId })
}
