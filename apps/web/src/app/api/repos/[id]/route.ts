import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { githubRepos, issues } from '@mobster/db'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, id)).get()

  if (!repo) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
  }

  // Delete issues first (cascade should handle this, but be explicit)
  db.delete(issues).where(eq(issues.repoId, id)).run()
  db.delete(githubRepos).where(eq(githubRepos.id, id)).run()

  return NextResponse.json({ deleted: true })
}
