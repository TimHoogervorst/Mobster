import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export { schema }
export * from './schema'
export { ensureSchema } from './ensure-schema'
export { SCHEMA_DDL } from './schema-ddl'

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL')
  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON')

  return drizzle(sqlite, { schema })
}

export type DbClient = ReturnType<typeof createDb>
