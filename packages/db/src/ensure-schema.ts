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
    sqlite.exec(SCHEMA_DDL)
  } finally {
    sqlite.close()
  }
}
