import type { DbClient } from '@mobster/db'
import { appSettings, issues, items } from '@mobster/db'
import { eq, and } from 'drizzle-orm'

/**
 * One-shot migration: copy all rows from the legacy `issues` table
 * into the unified `items` table. Preserves existing IDs so PRD
 * links (prds.issueId, prd_issues.issueId) remain valid.
 *
 * Idempotent — checks for the 'migrated_issues_to_items' setting
 * and skips if already run.
 */
export function migrateIssuesToItems(db: DbClient): void {
  // Check if migration already ran
  const flag = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'migrated_issues_to_items'))
    .get()

  if (flag) return

  const existingIssues = db.select().from(issues).all()
  const now = new Date().toISOString()

  let migrated = 0
  let skipped = 0

  for (const issue of existingIssues) {
    // Check if this issue already exists in the items table
    const exists = db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.source, 'github'),
          eq(items.githubId, issue.githubId),
          eq(items.repoId, issue.repoId),
        ),
      )
      .get()

    if (exists) {
      skipped++
      continue
    }

    db.insert(items)
      .values({
        id: issue.id, // Preserve existing IDs so PRD links don't break
        title: issue.title,
        description: issue.body,
        itemType: issue.issueType || 'other',
        status: issue.state,
        source: 'github',
        sourceId: String(issue.githubId),
        sourceUrl: issue.githubUrl,
        sourceData: JSON.stringify({
          githubId: issue.githubId,
          issueNumber: issue.number,
          migratedFrom: 'issues_table',
        }),
        size: null,
        requiresReview: 1,
        repoId: issue.repoId,
        number: issue.number,
        labels: issue.labels,
        assignee: issue.assignee,
        milestone: issue.milestone,
        githubId: issue.githubId,
        githubCreatedAt: issue.githubCreatedAt,
        githubUpdatedAt: issue.githubUpdatedAt,
        userNotes: issue.userNotes,
        userTags: issue.userTags,
        origin: 'sync',
        syncedAt: now,
        createdAt: issue.createdAt,
        updatedAt: now,
      })
      .run()
    migrated++
  }

  // Mark migration as done
  db.insert(appSettings)
    .values({ key: 'migrated_issues_to_items', value: 'true', updatedAt: now })
    .run()

  console.log(
    `[migrate-to-items] Migration complete: ${migrated} migrated, ${skipped} skipped (already in items table)`,
  )
}
