import Database from 'better-sqlite3'
import { randomBytes } from 'crypto'
import { ensureSchema } from '@mobster/db'

/**
 * Initialize the app on server startup.
 * - Ensures all database tables exist (embedded DDL, no migration files)
 * - Loads settings from DB into process.env
 * - Auto-generates AUTH_SECRET and ENCRYPTION_KEY if not present
 */
export function initializeApp(): void {
  const dbPath = process.env.DATABASE_PATH ?? './mobster.db'

  // Step 1: Ensure all tables exist
  try {
    ensureSchema(dbPath)
    console.log('[startup] Schema ensured')
  } catch (error: any) {
    console.error('[startup] ⚠️  SCHEMA SETUP FAILED:', error.message)
    throw error
  }

  // Step 2: Open DB, load settings, generate secrets
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  let hasAuthSecret = false
  let hasEncryptionKey = false

  try {
    const rows = sqlite.prepare('SELECT key, value FROM app_settings').all() as Array<{
      key: string
      value: string
    }>

    for (const row of rows) {
      switch (row.key) {
        case 'auth_secret':
          process.env.AUTH_SECRET = row.value
          hasAuthSecret = true
          break
        case 'encryption_key':
          process.env.ENCRYPTION_KEY = row.value
          hasEncryptionKey = true
          break
      }
    }
    console.log('[startup] Loaded settings' +
      (hasAuthSecret ? ' (auth_secret)' : '') +
      (hasEncryptionKey ? ' (encryption_key)' : ''))
  } catch (error: any) {
    console.warn('[startup] Could not read app_settings:', error.message)
  }

  // Step 3: Auto-generate secrets if missing
  const now = new Date().toISOString()

  if (!hasAuthSecret) {
    const secret = randomBytes(32).toString('hex')
    process.env.AUTH_SECRET = secret
    try {
      sqlite
        .prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('auth_secret', secret, now)
      console.log('[startup] Generated and persisted new auth_secret')
    } catch (e: any) {
      console.warn('[startup] Could not persist auth_secret:', e.message)
    }
  }

  if (!hasEncryptionKey && !process.env.ENCRYPTION_KEY) {
    const key = randomBytes(32).toString('hex')
    process.env.ENCRYPTION_KEY = key
    try {
      sqlite
        .prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('encryption_key', key, now)
      console.log('[startup] Generated and persisted new encryption_key')
    } catch (e: any) {
      console.warn('[startup] Could not persist encryption_key:', e.message)
    }
  }

  sqlite.close()

  // Fallback: always have critical secrets in memory
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = randomBytes(32).toString('hex')
  }
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')
    console.log('[startup] Using ephemeral encryption_key')
  }

  console.log('[startup] App initialized successfully')
}
