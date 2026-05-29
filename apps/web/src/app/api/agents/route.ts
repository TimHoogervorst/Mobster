import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agents } from '@mobster/db'
import { AgentCreateInput } from '@mobster/shared'
import { encrypt } from '@mobster/shared'
import { eq } from 'drizzle-orm'

// ─── GET: List all agents ──────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const allAgents = db.select().from(agents).all()

  // Return agents with masked API key — never expose the encrypted key either
  const safeAgents = allAgents.map((a) => ({
    id: a.id,
    name: a.name,
    providerType: a.providerType,
    apiKeyMasked: '••••',
    baseUrl: a.baseUrl,
    modelOpus: a.modelOpus,
    modelSonnet: a.modelSonnet,
    modelHaiku: a.modelHaiku,
    extraEnvVars: a.extraEnvVars ? JSON.parse(a.extraEnvVars) : null,
    systemPromptTemplate: a.systemPromptTemplate,
    isActive: !!a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))

  return NextResponse.json({ agents: safeAgents })
}

// ─── POST: Create a new agent ──────────────────────────

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = AgentCreateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const now = new Date().toISOString()

  // If this agent is set as active, deactivate all others
  if (parsed.data.isActive) {
    db.update(agents)
      .set({ isActive: 0, updatedAt: now })
      .where(eq(agents.isActive, 1))
      .run()
  }

  const encryptedKey = encrypt(parsed.data.apiKey)
  const id = uuid()

  db.insert(agents)
    .values({
      id,
      name: parsed.data.name,
      providerType: parsed.data.providerType,
      apiKeyEncrypted: encryptedKey,
      baseUrl: parsed.data.baseUrl || null,
      modelOpus: parsed.data.modelOpus,
      modelSonnet: parsed.data.modelSonnet,
      modelHaiku: parsed.data.modelHaiku,
      extraEnvVars: parsed.data.extraEnvVars
        ? JSON.stringify(parsed.data.extraEnvVars)
        : null,
      systemPromptTemplate: parsed.data.systemPromptTemplate || null,
      isActive: parsed.data.isActive ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const created = db.select().from(agents).where(eq(agents.id, id)).get()

  return NextResponse.json(
    {
      agent: created
        ? {
            id: created.id,
            name: created.name,
            providerType: created.providerType,
            apiKeyMasked: '••••',
            baseUrl: created.baseUrl,
            modelOpus: created.modelOpus,
            modelSonnet: created.modelSonnet,
            modelHaiku: created.modelHaiku,
            extraEnvVars: created.extraEnvVars
              ? JSON.parse(created.extraEnvVars)
              : null,
            systemPromptTemplate: created.systemPromptTemplate,
            isActive: !!created.isActive,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          }
        : null,
    },
    { status: 201 },
  )
}
