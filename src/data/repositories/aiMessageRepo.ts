import type { AIMessage } from '../../core/types'
import { db } from '../db/db'

export async function addAIMessage(message: AIMessage): Promise<void> {
  await db.aiMessages.add(message)
}

export async function updateAIMessageState(
  id: string,
  actionState: 'confirmed' | 'cancelled',
): Promise<void> {
  await db.aiMessages.update(id, { actionState })
}

export async function getAIMessageHistory(
  owner: { userId: string; shopId: string },
  conversationId?: string,
): Promise<AIMessage[]> {
  if (conversationId) {
    return db.aiMessages
      .where({ conversationId })
      .sortBy('createdAt')
  }
  return db.aiMessages
    .where({ userId: owner.userId, shopId: owner.shopId })
    .sortBy('createdAt')
}

export async function clearAIMessageHistory(
  owner: { userId: string; shopId: string },
  conversationId?: string,
): Promise<void> {
  if (conversationId) {
    await db.aiMessages.where({ conversationId }).delete()
    return
  }
  await db.aiMessages
    .where({ userId: owner.userId, shopId: owner.shopId })
    .delete()
}
