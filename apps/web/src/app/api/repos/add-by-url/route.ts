import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { createGitHubClient } from '@/lib/github'
import { githubRepos, users } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { AddRepoByUrlInput } from '@mobster/shared'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = AddRepoByUrlInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { owner, name, fullName } = parsed.data.url

  const db = getDb()

  // Check if repo is already connected
  const existing = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.fullName, fullName))
    .get()

  if (existing) {
    return NextResponse.json(
      { error: 'Repository is already connected', repo: existing },
      { status: 409 },
    )
  }

  // Get the user record
  const user = db
    .select()
    .from(users)
    .where(eq(users.githubId, session.user.githubId!))
    .get()

  if (!user) {
    return NextResponse.json(
      { error: 'User not found in database' },
      { status: 500 },
    )
  }

  // Fetch repo metadata from GitHub
  const github = createGitHubClient(session.accessToken)
  let repoMeta: Awaited<ReturnType<typeof github.getRepo>>

  try {
    repoMeta = await github.getRepo(owner, name)
  } catch (err: any) {
    if (err?.status === 404) {
      return NextResponse.json(
        {
          error:
            'Repository not found. Check that the URL is correct and the repo exists.',
        },
        { status: 404 },
      )
    }
    console.error('Failed to fetch repo from GitHub:', err)
    return NextResponse.json(
      { error: 'Failed to fetch repository from GitHub' },
      { status: 502 },
    )
  }

  // Insert into database with full metadata
  const now = new Date().toISOString()
  const id = uuid()

  db.insert(githubRepos)
    .values({
      id,
      userId: user.id,
      owner: repoMeta.owner,
      name: repoMeta.name,
      fullName: repoMeta.fullName,
      defaultBranch: repoMeta.defaultBranch,
      description: repoMeta.description,
      language: repoMeta.language,
      stars: repoMeta.stars,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return NextResponse.json(
    {
      created: { id, fullName, owner, name },
      repo: {
        id,
        fullName: repoMeta.fullName,
        owner: repoMeta.owner,
        name: repoMeta.name,
        description: repoMeta.description,
        language: repoMeta.language,
        stars: repoMeta.stars,
        defaultBranch: repoMeta.defaultBranch,
        private: repoMeta.private,
      },
    },
    { status: 201 },
  )
}
