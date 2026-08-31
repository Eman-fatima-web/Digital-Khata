import type { Conversation } from '../../core/types'
import { db } from '../db/db'
import { generateId, nowISO } from '../../lib/utils'

export async function createConversation(
  userId: string,
  shopId: string,
  title?: string,
): Promise<Conversation> {
  const now = nowISO()
  const conv: Conversation = {
    id: generateId(),
    userId,
    shopId,
    title: title || 'New Chat',
    createdAt: now,
    updatedAt: now,
  }
  await db.conversations.add(conv)
  return conv
}

export async function getConversations(
  userId: string,
  shopId: string,
): Promise<Conversation[]> {
  return db.conversations
    .where({ userId, shopId })
    .reverse()
    .sortBy('updatedAt')
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  await db.conversations.update(id, { title, updatedAt: nowISO() })
}

export async function touchConversation(id: string): Promise<void> {
  await db.conversations.update(id, { updatedAt: nowISO() })
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', db.conversations, db.aiMessages, async () => {
    await db.aiMessages.where({ conversationId: id }).delete()
    await db.conversations.delete(id)
  })
}

export async function clearAllConversations(
  userId: string,
  shopId: string,
): Promise<void> {
  await db.transaction('rw', db.conversations, db.aiMessages, async () => {
    const convs = await db.conversations.where({ userId, shopId }).toArray()
    for (const c of convs) {
      await db.aiMessages.where({ conversationId: c.id }).delete()
    }
    await db.conversations.where({ userId, shopId }).delete()
  })
}
