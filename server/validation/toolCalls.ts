import { z } from 'zod'

/**
 * Structured tool call validation using Zod schemas.
 * Ensures AI-generated tool calls have valid, safe arguments.
 */

// Tool argument schemas
export const RecordPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(999999999),
  method: z.enum(['Cash', 'Bank Transfer', 'JazzCash', 'Easypaisa']),
  udhaarId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const AddUdhaarSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(999999999),
  description: z.string().max(500),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
})

export const RecordSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  amount: z.number().positive().max(999999999),
  description: z.string().max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const SendReminderSchema = z.object({
  customerId: z.string().uuid(),
  message: z.string().max(1000),
  channel: z.enum(['whatsapp', 'sms', 'share']),
  phone: z.string().optional(),
})

export const SetThemeSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
})

export const SetLanguageSchema = z.object({
  language: z.enum(['en', 'ur']),
})

export const UpdateNotificationPreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  overdueReminders: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  proactiveInsights: z.boolean().optional(),
})

export const UpdateVoicePreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  autoSpeak: z.boolean().optional(),
})

// Tool name to schema mapping
export const ToolSchemas = {
  record_payment: RecordPaymentSchema,
  add_udhaar: AddUdhaarSchema,
  create_customer: CreateCustomerSchema,
  record_sale: RecordSaleSchema,
  send_reminder: SendReminderSchema,
  set_theme: SetThemeSchema,
  set_language: SetLanguageSchema,
  update_notification_preferences: UpdateNotificationPreferencesSchema,
  update_voice_preferences: UpdateVoicePreferencesSchema,
} as const

export type ToolName = keyof typeof ToolSchemas

/**
 * Validate a tool call against its schema.
 * Returns validated data or throws ValidationError.
 */
export function validateToolCall(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const schema = ToolSchemas[toolName as ToolName]
  
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`)
  }

  try {
    return schema.parse(args)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Invalid tool arguments: ${messages}`, { cause: error })
    }
    throw error
  }
}

/**
 * Check if a tool requires confirmation before execution.
 */
export function requiresConfirmation(toolName: string): boolean {
  // All write operations require confirmation
  const writeTools: ToolName[] = [
    'record_payment',
    'add_udhaar',
    'create_customer',
    'record_sale',
    'send_reminder',
    'set_theme',
    'set_language',
    'update_notification_preferences',
    'update_voice_preferences',
  ]
  return writeTools.includes(toolName as ToolName)
}

/**
 * Get the permission level for a tool.
 */
export function getToolPermissionLevel(toolName: string): 'read' | 'write' | 'high_risk' {
  const highRiskTools: ToolName[] = [
    'send_reminder', // External messaging
  ]
  
  const writeTools: ToolName[] = [
    'record_payment',
    'add_udhaar',
    'create_customer',
    'record_sale',
    'set_theme',
    'set_language',
    'update_notification_preferences',
    'update_voice_preferences',
  ]

  if (highRiskTools.includes(toolName as ToolName)) {
    return 'high_risk'
  }
  if (writeTools.includes(toolName as ToolName)) {
    return 'write'
  }
  return 'read'
}
