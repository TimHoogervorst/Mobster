import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { syncRepo, syncIssues, syncPullRequests } from '@/lib/sync'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  try {
    // Legacy sync (writes to issues table — backward compat)
    const legacyResult = await syncRepo(db, session.accessToken, id)

    // Phase 3.5: also sync to unified items table
    let issuesResult = null
    let prsResult = null
    try {
      issuesResult = await syncIssues(db, session.accessToken, id)
      prsResult = await syncPullRequests(db, session.accessToken, id)
    } catch (err: any) {
      console.warn('[sync] Unified items sync failed (non-fatal):', err.message)
    }

    return NextResponse.json({
      legacy: legacyResult,
      items: issuesResult,
      pullRequests: prsResult,
    })
  } catch (error: any) {
    if (error.message?.includes('Repo not found')) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
    }
    console.error('Sync failed:', error)
    return NextResponse.json(
      { error: 'GitHub API error', details: error.message },
      { status: 502 },
    )
  }
}
