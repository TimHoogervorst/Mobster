import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'
import type { DbClient } from '@mobster/db'
import { githubRepos, issues } from '@mobster/db'
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

// ─── Sync Engine ──────────────────────────────────────

/**
 * Sync issues from a GitHub repo into the local database.
 * Uses upsert logic: issues are matched by `githubId` within the same repo.
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
          body: gi.body,
          state: gi.state,
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
          body: gi.body,
          state: gi.state,
          issueType: classifyIssueType(gi.labels),
          labels: JSON.stringify(gi.labels),
          assignee: gi.assignee,
          milestone: gi.milestone,
          githubUrl: gi.githubUrl,
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
