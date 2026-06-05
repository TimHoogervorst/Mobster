import { v4 as uuid } from 'uuid'
import { and, eq } from 'drizzle-orm'
import type { DbClient } from '@mobster/db'
import { githubRepos, issues, items } from '@mobster/db'
import { createGitHubClient } from '@/lib/github'
import type { IssueType } from '@mobster/shared'

// ─── Label → Issue Type Classification ───────────────

const LABEL_TYPE_MAP: Record<string, IssueType> = {
  bug: 'bug',
  feature: 'feature',
  enhancement: 'feature',
  question: 'question',
  discussion: 'question',
}

/**
 * Classify an issue based on its GitHub labels.
 * Falls back to 'other' if no known label is found.
 */
export function classifyIssueType(labels: string[]): IssueType {
  const lowerLabels = labels.map((l) => l.toLowerCase())
  for (const label of lowerLabels) {
    for (const [pattern, type] of Object.entries(LABEL_TYPE_MAP)) {
      if (label.includes(pattern)) {
        return type
      }
    }
  }
  return 'other'
}

// ─── Sync Result ──────────────────────────────────────

export interface SyncResult {
  repoId: string
  fullName: string
  created: number
  updated: number
  skipped: number
  syncedAt: string
}

// ─── Legacy Sync (writes to issues table — backward compat) ──

/**
 * Sync issues from a GitHub repo into the local database.
 * Uses upsert logic: issues are matched by `githubId` within the same repo.
 *
 * @deprecated Use syncIssues + syncPullRequests which write to the unified items table.
 */
export async function syncRepo(
  db: DbClient,
  accessToken: string,
  repoId: string,
): Promise<SyncResult> {
  const github = createGitHubClient(accessToken)

  // Get the repo record
  const repo = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.id, repoId))
    .get()

  if (!repo) {
    throw new Error(`Repo not found: ${repoId}`)
  }

  // Fetch issues from GitHub (incremental if previously synced)
  const since = repo.syncedAt ? new Date(repo.syncedAt) : undefined
  const githubIssues = await github.listIssues(repo.owner, repo.name, since)

  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const gi of githubIssues) {
    // Check if issue already exists in local DB
    const existing = db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.githubId, gi.githubId))
      .get()

    if (existing) {
      // Update existing issue
      db.update(issues)
        .set({
          title: gi.title,
          body: gi.description,
          state: gi.status as 'open' | 'closed',
          labels: JSON.stringify(gi.labels),
          assignee: gi.assignee,
          milestone: gi.milestone,
          githubUpdatedAt: gi.githubUpdatedAt,
          updatedAt: now,
        })
        .where(eq(issues.id, existing.id))
        .run()
      updated++
    } else {
      // Insert new issue
      db.insert(issues)
        .values({
          id: uuid(),
          repoId: repo.id,
          githubId: gi.githubId,
          number: gi.number,
          title: gi.title,
          body: gi.description,
          state: gi.status as 'open' | 'closed',
          issueType: classifyIssueType(gi.labels),
          labels: JSON.stringify(gi.labels),
          assignee: gi.assignee,
          milestone: gi.milestone,
          githubUrl: gi.sourceUrl,
          githubCreatedAt: gi.githubCreatedAt,
          githubUpdatedAt: gi.githubUpdatedAt,
          createdAt: now,
          updatedAt: now,
        })
        .run()
      created++
    }
  }

  // Update repo sync timestamp
  db.update(githubRepos)
    .set({ syncedAt: now, updatedAt: now })
    .where(eq(githubRepos.id, repoId))
    .run()

  return {
    repoId: repo.id,
    fullName: repo.fullName,
    created,
    updated,
    skipped: githubIssues.length - created - updated,
    syncedAt: now,
  }
}

// ─── Unified Sync (writes to items table — Phase 3.5) ──

/**
 * Sync issues from GitHub into the unified `items` table.
 */
export async function syncIssues(
  db: DbClient,
  accessToken: string,
  repoId: string,
): Promise<SyncResult> {
  const github = createGitHubClient(accessToken)
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, repoId)).get()
  if (!repo) throw new Error(`Repo not found: ${repoId}`)

  const since = repo.syncedAt ? new Date(repo.syncedAt) : undefined
  const normalizedItems = await github.listIssues(repo.owner, repo.name, since)

  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const ni of normalizedItems) {
    const existing = db.select({ id: items.id })
      .from(items)
      .where(and(
        eq(items.source, 'github'),
        eq(items.sourceId, ni.sourceId),
        eq(items.repoId, repoId),
      ))
      .get()

    if (existing) {
      db.update(items).set({
        title: ni.title,
        description: ni.description,
        status: ni.status,
        labels: JSON.stringify(ni.labels),
        assignee: ni.assignee,
        milestone: ni.milestone,
        sourceData: JSON.stringify(ni.sourceData),
        githubUpdatedAt: ni.githubUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      }).where(eq(items.id, existing.id)).run()
      updated++
    } else {
      db.insert(items).values({
        id: uuid(),
        title: ni.title,
        description: ni.description,
        itemType: ni.itemType,
        status: ni.status,
        source: 'github',
        sourceId: ni.sourceId,
        sourceUrl: ni.sourceUrl,
        sourceData: JSON.stringify(ni.sourceData),
        size: null,
        requiresReview: 1,
        repoId,
        number: ni.number,
        labels: JSON.stringify(ni.labels),
        assignee: ni.assignee,
        author: ni.author,
        milestone: ni.milestone,
        headBranch: ni.headBranch,
        baseBranch: ni.baseBranch,
        isDraft: ni.isDraft ? 1 : 0,
        githubId: ni.githubId,
        githubCreatedAt: ni.githubCreatedAt,
        githubUpdatedAt: ni.githubUpdatedAt,
        origin: 'sync',
        syncedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run()
      created++
    }
  }

  return { repoId: repo.id, fullName: repo.fullName, created, updated, skipped: 0, syncedAt: now }
}

/**
 * Sync pull requests from GitHub into the unified `items` table.
 */
export async function syncPullRequests(
  db: DbClient,
  accessToken: string,
  repoId: string,
): Promise<SyncResult> {
  const github = createGitHubClient(accessToken)
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, repoId)).get()
  if (!repo) throw new Error(`Repo not found: ${repoId}`)

  const normalizedItems = await github.listPullRequests(repo.owner, repo.name)

  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const ni of normalizedItems) {
    const existing = db.select({ id: items.id })
      .from(items)
      .where(and(
        eq(items.source, 'github'),
        eq(items.sourceId, ni.sourceId),
        eq(items.repoId, repoId),
      ))
      .get()

    if (existing) {
      db.update(items).set({
        title: ni.title,
        description: ni.description,
        status: ni.status,
        labels: JSON.stringify(ni.labels),
        assignee: ni.assignee,
        author: ni.author,
        milestone: ni.milestone,
        headBranch: ni.headBranch,
        baseBranch: ni.baseBranch,
        isDraft: ni.isDraft ? 1 : 0,
        sourceData: JSON.stringify(ni.sourceData),
        githubUpdatedAt: ni.githubUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      }).where(eq(items.id, existing.id)).run()
      updated++
    } else {
      db.insert(items).values({
        id: uuid(),
        title: ni.title,
        description: ni.description,
        itemType: ni.itemType,
        status: ni.status,
        source: 'github',
        sourceId: ni.sourceId,
        sourceUrl: ni.sourceUrl,
        sourceData: JSON.stringify(ni.sourceData),
        size: null,
        requiresReview: 1,
        repoId,
        number: ni.number,
        labels: JSON.stringify(ni.labels),
        assignee: ni.assignee,
        author: ni.author,
        milestone: ni.milestone,
        headBranch: ni.headBranch,
        baseBranch: ni.baseBranch,
        isDraft: ni.isDraft ? 1 : 0,
        githubId: ni.githubId,
        githubCreatedAt: ni.githubCreatedAt,
        githubUpdatedAt: ni.githubUpdatedAt,
        origin: 'sync',
        syncedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run()
      created++
    }
  }

  return { repoId: repo.id, fullName: repo.fullName, created, updated, skipped: 0, syncedAt: now }
}
