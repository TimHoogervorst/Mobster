import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { createGitHubClient } from '@/lib/github'
import { githubRepos, users } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { RepoSelectInput } from '@mobster/shared'

// ─── GET: List repos ──────────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const github = createGitHubClient(session.accessToken)

  // Fetch repos from GitHub
  const ghRepos = await github.listRepos()

  // Get connected repos from local DB
  const connected = db.select().from(githubRepos).all()

  const connectedMap = new Map(
    connected.map((r) => [r.fullName, r]),
  )

  // Merge: mark which GitHub repos are already connected
  const repos = ghRepos.map((gh) => ({
    id: gh.id,
    fullName: gh.fullName,
    owner: gh.owner,
    name: gh.name,
    description: gh.description,
    language: gh.language,
    stars: gh.stars,
    defaultBranch: gh.defaultBranch,
    connected: connectedMap.has(gh.fullName),
    connectedRepoId: connectedMap.get(gh.fullName)?.id ?? null,
    lastSyncedAt: connectedMap.get(gh.fullName)?.syncedAt ?? null,
    // issueCount requires a separate query — omit for list view
  }))

  return NextResponse.json({ repos })
}

// ─── POST: Save selected repos ────────────────────────

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = RepoSelectInput.array().safeParse(body.repos)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  // Get the user record
  const user = db.select().from(users).where(eq(users.githubId, session.user.githubId!)).get()

  if (!user) {
    return NextResponse.json({ error: 'User not found in database' }, { status: 500 })
  }

  const now = new Date().toISOString()
  let created = 0
  const createdRepos: Array<{ id: string; fullName: string }> = []

  for (const repo of parsed.data) {
    // Skip if already connected
    const existing = db
      .select()
      .from(githubRepos)
      .where(eq(githubRepos.fullName, repo.fullName))
      .get()

    if (existing) continue

    const id = uuid()
    db.insert(githubRepos)
      .values({
        id,
        userId: user.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    created++
    createdRepos.push({ id, fullName: repo.fullName })
  }

  return NextResponse.json({ created, repos: createdRepos }, { status: 201 })
}
