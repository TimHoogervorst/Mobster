/**
 * Embedded DDL for all application tables.
 *
 * Generated from the current Drizzle schema (drizzle-kit generate).
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on every startup.
 *
 * TO REGENERATE after schema changes:
 *   1. cd packages/db && npx drizzle-kit generate
 *   2. Copy the SQL from the generated migration
 *   3. Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
 */
export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY NOT NULL,
  value text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  github_id text NOT NULL UNIQUE,
  github_token text NOT NULL,
  name text,
  email text,
  avatar_url text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS github_repos (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL UNIQUE,
  default_branch text DEFAULT 'main' NOT NULL,
  description text,
  language text,
  stars integer DEFAULT 0,
  synced_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id text PRIMARY KEY NOT NULL,
  repo_id text NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  github_id integer NOT NULL,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text NOT NULL,
  issue_type text,
  labels text,
  assignee text,
  milestone text,
  github_url text NOT NULL,
  github_created_at text,
  github_updated_at text,
  user_notes text,
  user_tags text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS prds (
  id text PRIMARY KEY NOT NULL,
  issue_id text REFERENCES issues(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL,
  agent_model text,
  agent_prompt text,
  agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  version integer DEFAULT 1 NOT NULL,
  parent_prd_id text,
  scheduled_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL,
  api_key_encrypted text NOT NULL,
  base_url text,
  model_opus text NOT NULL,
  model_sonnet text NOT NULL,
  model_haiku text NOT NULL,
  extra_env_vars text,
  system_prompt_template text,
  is_active integer DEFAULT 0 NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS prd_issues (
  id text PRIMARY KEY NOT NULL,
  prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  created_at text NOT NULL,
  UNIQUE(issue_id)
);

CREATE TABLE IF NOT EXISTS prd_comments (
  id text PRIMARY KEY NOT NULL,
  prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id text PRIMARY KEY NOT NULL,
  prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  content text NOT NULL,
  metadata text,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS build_jobs (
  id text PRIMARY KEY NOT NULL,
  prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  status text NOT NULL,
  agent_log text,
  pr_url text,
  branch_name text,
  error text,
  retry_count integer DEFAULT 0 NOT NULL,
  max_retries integer DEFAULT 3 NOT NULL,
  started_at text,
  completed_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

-- Phase 2 migrations: add columns to existing tables
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we handle errors in ensureSchema
ALTER TABLE prds ADD COLUMN agent_id text REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE build_jobs ADD COLUMN test_results text;
`
