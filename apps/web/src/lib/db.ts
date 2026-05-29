import { createDb, type DbClient, ensureSchema } from '@mobster/db'

const globalForDb = globalThis as unknown as { _db: DbClient | undefined; _schemaEnsured: boolean }

/**
 * Get or create the SQLite database client.
 * Ensures the schema exists on first call (idempotent).
 */
export function getDb(): DbClient {
  if (globalForDb._db) {
    return globalForDb._db
  }

  const dbPath = process.env.DATABASE_PATH ?? './mobster.db'

  // Ensure schema on first access (idempotent)
  if (!globalForDb._schemaEnsured) {
    try {
      ensureSchema(dbPath)
      globalForDb._schemaEnsured = true
    } catch (error: any) {
      console.error('[db] ⚠️  SCHEMA SETUP FAILED:', error.message)
    }
  }

  const db = createDb(dbPath)
  globalForDb._db = db
  return db
}
