import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

describe('database schema', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })

    // Run the migration SQL to create tables
    sqlite.exec(`
      CREATE TABLE users (
        id text PRIMARY KEY NOT NULL,
        github_id text NOT NULL UNIQUE,
        github_token text NOT NULL,
        name text,
        email text,
        avatar_url text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE github_repos (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner text NOT NULL,
        name text NOT NULL,
        full_name text NOT NULL UNIQUE,
        default_branch text NOT NULL DEFAULT 'main',
        description text,
        language text,
        stars integer DEFAULT 0,
        synced_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE issues (
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
      CREATE TABLE prds (
        id text PRIMARY KEY NOT NULL,
        issue_id text REFERENCES issues(id) ON DELETE SET NULL,
        title text NOT NULL,
        content text NOT NULL,
        status text NOT NULL,
        agent_model text,
        agent_prompt text,
        agent_id text REFERENCES agents(id) ON DELETE SET NULL,
        version integer NOT NULL DEFAULT 1,
        parent_prd_id text,
        scheduled_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE agents (
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
        is_active integer NOT NULL DEFAULT 0,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE prd_issues (
        id text PRIMARY KEY NOT NULL,
        prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
        issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        created_at text NOT NULL,
        UNIQUE(issue_id)
      );
      CREATE TABLE prd_comments (
        id text PRIMARY KEY NOT NULL,
        prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at text NOT NULL
      );
      CREATE TABLE agent_logs (
        id text PRIMARY KEY NOT NULL,
        prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
        agent_id text REFERENCES agents(id) ON DELETE SET NULL,
        session_id text NOT NULL,
        event_type text NOT NULL,
        content text NOT NULL,
        metadata text,
        created_at text NOT NULL
      );
      CREATE TABLE build_jobs (
        id text PRIMARY KEY NOT NULL,
        prd_id text NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
        status text NOT NULL,
        agent_log text,
        pr_url text,
        branch_name text,
        error text,
        retry_count integer NOT NULL DEFAULT 0,
        max_retries integer NOT NULL DEFAULT 3,
        started_at text,
        completed_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
    `)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('should insert and query a user', () => {
    sqlite.exec(`
      INSERT INTO users (id, github_id, github_token, name, email, created_at, updated_at)
      VALUES ('user-1', '12345', 'encrypted-token', 'Test User', 'test@example.com', '2026-01-01', '2026-01-01')
    `)
    const rows = sqlite.prepare('SELECT * FROM users WHERE id = ?').all('user-1') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Test User')
  })

  it('should insert and query an agent', () => {
    sqlite.exec(`
      INSERT INTO agents (id, name, provider_type, api_key_encrypted, model_opus, model_sonnet, model_haiku, is_active, created_at, updated_at)
      VALUES ('agent-1', 'My Agent', 'anthropic-sdk', 'encrypted-key', 'opus-model', 'sonnet-model', 'haiku-model', 1, '2026-01-01', '2026-01-01')
    `)
    const rows = sqlite.prepare('SELECT * FROM agents WHERE id = ?').all('agent-1') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('My Agent')
    expect(rows[0]!.is_active).toBe(1)
  })

  it('should enforce unique issue_id in prd_issues', () => {
    // Setup: need a user, repo, issue, and PRD first
    sqlite.exec(`
      INSERT INTO users (id, github_id, github_token, created_at, updated_at)
      VALUES ('user-1', '12345', 'token', '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO github_repos (id, user_id, owner, name, full_name, created_at, updated_at)
      VALUES ('repo-1', 'user-1', 'own', 'rep', 'own/rep', '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO issues (id, repo_id, github_id, number, title, state, github_url, created_at, updated_at)
      VALUES ('issue-1', 'repo-1', 1, 1, 'Test Issue', 'open', 'https://github.com/own/rep/issues/1', '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO prds (id, title, content, status, version, created_at, updated_at)
      VALUES ('prd-1', 'Test PRD', 'Content here', 'draft', 1, '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO prd_issues (id, prd_id, issue_id, created_at)
      VALUES ('pi-1', 'prd-1', 'issue-1', '2026-01-01')
    `)
    // Duplicate issue_id should fail
    expect(() => {
      sqlite.exec(`
        INSERT INTO prd_issues (id, prd_id, issue_id, created_at)
        VALUES ('pi-2', 'prd-1', 'issue-1', '2026-01-01')
      `)
    }).toThrow()
  })

  it('should cascade delete prd_comments when prd is deleted', () => {
    sqlite.exec(`
      INSERT INTO prds (id, title, content, status, version, created_at, updated_at)
      VALUES ('prd-2', 'Comment Test', 'Content', 'draft', 1, '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO prd_comments (id, prd_id, content, created_at)
      VALUES ('comment-1', 'prd-2', 'Great PRD!', '2026-01-01')
    `)
    sqlite.exec(`DELETE FROM prds WHERE id = 'prd-2'`)
    const comments = sqlite.prepare('SELECT * FROM prd_comments WHERE id = ?').all('comment-1')
    expect(comments).toHaveLength(0)
  })

  it('should cascade delete repos when user is deleted', () => {
    sqlite.exec(`
      INSERT INTO users (id, github_id, github_token, created_at, updated_at)
      VALUES ('user-1', '12345', 'token', '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`
      INSERT INTO github_repos (id, user_id, owner, name, full_name, created_at, updated_at)
      VALUES ('repo-1', 'user-1', 'testowner', 'testrepo', 'testowner/testrepo', '2026-01-01', '2026-01-01')
    `)
    sqlite.exec(`DELETE FROM users WHERE id = 'user-1'`)
    const repos = sqlite.prepare('SELECT * FROM github_repos WHERE id = ?').all('repo-1')
    expect(repos).toHaveLength(0)
  })
})
