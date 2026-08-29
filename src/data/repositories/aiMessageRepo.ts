import type { AIMessage } from '../../core/types'
import { db } from '../db/db'

export async function addAIMessage(message: AIMessage): Promise<void> {
  await db.aiMessages.add(message)
}

// Only terminal states are persisted; a transient 'executing' state is never
// written so a reload can never leave a stuck spinner in history.
export async function updateAIMessageState(
  id: string,
  actionState: 'confirmed' | 'cancelled',
): Promise<void> {
  await db.aiMessages.update(id, { actionState })
}

export async function getAIMessageHistory(owner: {
  userId: string
  shopId: string
}): Promise<AIMessage[]> {
  return db.aiMessages
    .where({ userId: owner.userId, shopId: owner.shopId })
    .sortBy('createdAt')
}

export async function clearAIMessageHistory(owner: {
  userId: string
  shopId: string
}): Promise<void> {
  await db.aiMessages
    .where({ userId: owner.userId, shopId: owner.shopId })
    .delete()
}
