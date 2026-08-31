import type { ToolResult } from './tools.js'

/**
 * AI System Control Tools
 * 
 * These tools allow the AI to manage system settings securely.
 * All tools require appropriate permission levels.
 */

export type SystemSettings = {
  theme?: 'light' | 'dark' | 'system'
  language?: 'en' | 'ur'
  notifications?: {
    enabled: boolean
    paymentReminders: boolean
    overdueReminders: boolean
    dailySummary: boolean
    proactiveInsights: boolean
  }
  voice?: {
    enabled: boolean
    autoSpeak: boolean
  }
}

/**
 * Change application theme
 * Permission: WRITE
 */
export async function setTheme(
  theme: 'light' | 'dark' | 'system'
): Promise<ToolResult<{ theme: string }>> {
  try {
    // Validate theme value
    if (!['light', 'dark', 'system'].includes(theme)) {
      return { ok: false, error: 'invalid-theme', message: 'Invalid theme value' }
    }

    // In a real implementation, this would update user preferences in the database
    // For now, we return success
    return { 
      ok: true, 
      data: { theme },
    }
  } catch (error) {
    return { 
      ok: false, 
      error: 'settings-error', 
      message: `Failed to update theme: ${error}` 
    }
  }
}

/**
 * Change application language
 * Permission: WRITE
 */
export async function setLanguage(
  language: 'en' | 'ur'
): Promise<ToolResult<{ language: string }>> {
  try {
    // Validate language value
    if (!['en', 'ur'].includes(language)) {
      return { ok: false, error: 'invalid-language', message: 'Invalid language value' }
    }

    return { 
      ok: true, 
      data: { language },
    }
  } catch (error) {
    return { 
      ok: false, 
      error: 'settings-error', 
      message: `Failed to update language: ${error}` 
    }
  }
}

/**
 * Update notification preferences
 * Permission: WRITE
 */
export async function updateNotificationPreferences(
  preferences?: Partial<SystemSettings['notifications']>
): Promise<ToolResult<{ preferences: SystemSettings['notifications'] }>> {
  try {
    // Validate preferences
    const validPreferences: SystemSettings['notifications'] = {
      enabled: preferences?.enabled ?? true,
      paymentReminders: preferences?.paymentReminders ?? true,
      overdueReminders: preferences?.overdueReminders ?? true,
      dailySummary: preferences?.dailySummary ?? false,
      proactiveInsights: preferences?.proactiveInsights ?? true,
    }

    return { 
      ok: true, 
      data: { preferences: validPreferences },
    }
  } catch (error) {
    return { 
      ok: false, 
      error: 'settings-error', 
      message: `Failed to update notification preferences: ${error}` 
    }
  }
}

/**
 * Update voice preferences
 * Permission: WRITE
 */
export async function updateVoicePreferences(
  preferences?: Partial<SystemSettings['voice']>
): Promise<ToolResult<{ preferences: SystemSettings['voice'] }>> {
  try {
    const validPreferences: SystemSettings['voice'] = {
      enabled: preferences?.enabled ?? true,
      autoSpeak: preferences?.autoSpeak ?? false,
    }

    return { 
      ok: true, 
      data: { preferences: validPreferences },
    }
  } catch (error) {
    return { 
      ok: false, 
      error: 'settings-error', 
      message: `Failed to update voice preferences: ${error}` 
    }
  }
}

/**
 * Get current system settings
 * Permission: READ
 */
export async function getSystemSettings(): Promise<ToolResult<SystemSettings>> {
  try {
    // In a real implementation, this would fetch from database
    // For now, return defaults
    const settings: SystemSettings = {
      theme: 'light',
      language: 'en',
      notifications: {
        enabled: true,
        paymentReminders: true,
        overdueReminders: true,
        dailySummary: false,
        proactiveInsights: true,
      },
      voice: {
        enabled: true,
        autoSpeak: false,
      },
    }

    return { 
      ok: true, 
      data: settings,
    }
  } catch (error) {
    return { 
      ok: false, 
      error: 'settings-error', 
      message: `Failed to get system settings: ${error}` 
    }
  }
}
