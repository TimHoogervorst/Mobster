import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { syncRepo } from '@/lib/sync'

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
    const result = await syncRepo(db, session.accessToken, id)
    return NextResponse.json(result)
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
