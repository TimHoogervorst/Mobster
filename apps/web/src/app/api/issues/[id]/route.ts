import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { issues, githubRepos } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { IssueUpdateInput } from '@mobster/shared'

// ─── GET: Single issue ────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const issue = db.select().from(issues).where(eq(issues.id, id)).get()

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  // Get repo name
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, issue.repoId)).get()

  return NextResponse.json({
    ...issue,
    repoFullName: repo?.fullName ?? 'unknown',
    labels: parseLabels(issue.labels),
    userTags: parseLabels(issue.userTags),
  })
}

// ─── PATCH: Update local annotations ──────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = IssueUpdateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  const existing = db.select().from(issues).where(eq(issues.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (parsed.data.userNotes !== undefined) {
    updates.userNotes = parsed.data.userNotes
  }
  if (parsed.data.userTags !== undefined) {
    updates.userTags = JSON.stringify(parsed.data.userTags)
  }
  if (parsed.data.issueType !== undefined) {
    updates.issueType = parsed.data.issueType
  }

  db.update(issues).set(updates).where(eq(issues.id, id)).run()

  const updated = db.select().from(issues).where(eq(issues.id, id)).get()
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, updated!.repoId)).get()

  return NextResponse.json({
    ...updated,
    repoFullName: repo?.fullName ?? 'unknown',
    labels: parseLabels(updated!.labels),
    userTags: parseLabels(updated!.userTags),
  })
}

// ─── Helpers ──────────────────────────────────────────

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}
