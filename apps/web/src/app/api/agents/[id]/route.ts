import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agents } from '@mobster/db'
import { AgentUpdateInput } from '@mobster/shared'
import { encrypt } from '@mobster/shared'
import { eq } from 'drizzle-orm'

// ─── GET: Single agent ─────────────────────────────────

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

  const agent = db.select().from(agents).where(eq(agents.id, id)).get()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      providerType: agent.providerType,
      apiKeyMasked: '••••',
      baseUrl: agent.baseUrl,
      modelOpus: agent.modelOpus,
      modelSonnet: agent.modelSonnet,
      modelHaiku: agent.modelHaiku,
      extraEnvVars: agent.extraEnvVars ? JSON.parse(agent.extraEnvVars) : null,
      systemPromptTemplate: agent.systemPromptTemplate,
      isActive: !!agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    },
  })
}

// ─── PATCH: Update agent ───────────────────────────────

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
  const parsed = AgentUpdateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  const existing = db.select().from(agents).where(eq(agents.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name
  }
  if (parsed.data.providerType !== undefined) {
    updates.providerType = parsed.data.providerType
  }
  if (parsed.data.apiKey !== undefined && parsed.data.apiKey !== '') {
    updates.apiKeyEncrypted = encrypt(parsed.data.apiKey)
  }
  if (parsed.data.baseUrl !== undefined) {
    updates.baseUrl = parsed.data.baseUrl || null
  }
  if (parsed.data.modelOpus !== undefined) {
    updates.modelOpus = parsed.data.modelOpus
  }
  if (parsed.data.modelSonnet !== undefined) {
    updates.modelSonnet = parsed.data.modelSonnet
  }
  if (parsed.data.modelHaiku !== undefined) {
    updates.modelHaiku = parsed.data.modelHaiku
  }
  if (parsed.data.extraEnvVars !== undefined) {
    updates.extraEnvVars = Object.keys(parsed.data.extraEnvVars).length > 0
      ? JSON.stringify(parsed.data.extraEnvVars)
      : null
  }
  if (parsed.data.systemPromptTemplate !== undefined) {
    updates.systemPromptTemplate = parsed.data.systemPromptTemplate || null
  }
  if (parsed.data.isActive !== undefined) {
    updates.isActive = parsed.data.isActive ? 1 : 0

    // If activating this agent, deactivate all others
    if (parsed.data.isActive) {
      db.update(agents)
        .set({ isActive: 0, updatedAt: now })
        .where(eq(agents.isActive, 1))
        .run()
    }
  }

  db.update(agents).set(updates).where(eq(agents.id, id)).run()

  const updated = db.select().from(agents).where(eq(agents.id, id)).get()

  return NextResponse.json({
    agent: {
      id: updated!.id,
      name: updated!.name,
      providerType: updated!.providerType,
      apiKeyMasked: '••••',
      baseUrl: updated!.baseUrl,
      modelOpus: updated!.modelOpus,
      modelSonnet: updated!.modelSonnet,
      modelHaiku: updated!.modelHaiku,
      extraEnvVars: updated!.extraEnvVars ? JSON.parse(updated!.extraEnvVars) : null,
      systemPromptTemplate: updated!.systemPromptTemplate,
      isActive: !!updated!.isActive,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
    },
  })
}

// ─── DELETE: Remove agent ──────────────────────────────

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

  const existing = db.select().from(agents).where(eq(agents.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  db.delete(agents).where(eq(agents.id, id)).run()

  return NextResponse.json({ success: true })
}
