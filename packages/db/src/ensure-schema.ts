import Database from 'better-sqlite3'
import { SCHEMA_DDL } from './schema-ddl'

/**
 * Ensure all application tables exist in the database.
 * Uses CREATE TABLE IF NOT EXISTS — safe to call every startup.
 * No migration files needed at runtime.
 */
export function ensureSchema(dbPath: string): void {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  try {
    // Split DDL into individual statements and run each one.
    // This allows ALTER TABLE to fail gracefully if a column already exists.
    const statements = SCHEMA_DDL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const stmt of statements) {
      try {
        sqlite.exec(stmt + ';')
      } catch (error: any) {
        // Ignore "duplicate column" errors from ALTER TABLE statements
        if (error.message?.includes('duplicate column name')) {
          continue
        }
        // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS (shouldn't happen but defensive)
        if (error.message?.includes('already exists')) {
          continue
        }
        throw error
      }
    }
  } finally {
    sqlite.close()
  }
}
