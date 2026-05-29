import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { users } from '@mobster/db'
import { decrypt } from '@mobster/shared'
import { eq } from 'drizzle-orm'

const COOKIE_NAME = 'authjs.session-token'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export interface SessionUser {
  githubId: string
  name?: string | null
  image?: string | null
  email?: string | null
}

export interface Session {
  accessToken: string
  user: SessionUser
}

/**
 * Create a session after PAT validation.
 * Encrypts and stores the PAT in the users table, then sets a signed JWT cookie.
 */
export async function createSession(
  pat: string,
  githubUser: { id: string; login: string; name: string | null; avatar_url: string; email: string | null },
): Promise<void> {
  const db = getDb()
  const { encrypt } = await import('@mobster/shared')
  const { v4: uuid } = await import('uuid')

  const encryptedToken = encrypt(pat)
  const now = new Date().toISOString()
  const githubId = String(githubUser.id)

  const existing = db.select().from(users).where(eq(users.githubId, githubId)).get()

  if (existing) {
    db.update(users)
      .set({
        githubToken: encryptedToken,
        name: githubUser.name ?? existing.name,
        email: githubUser.email ?? existing.email,
        avatarUrl: githubUser.avatar_url,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id))
      .run()
  } else {
    db.insert(users)
      .values({
        id: uuid(),
        githubId,
        githubToken: encryptedToken,
        name: githubUser.name ?? githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  // Create signed JWT
  const token = await new SignJWT({
    githubId,
    githubUsername: githubUser.login,
    githubAvatar: githubUser.avatar_url,
    githubName: githubUser.name ?? githubUser.login,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/**
 * Read the current session from the cookie.
 * Returns the decrypted PAT as accessToken, plus user info.
 * Returns null if not signed in.
 */
export async function auth(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())

    const githubId = payload.githubId as string
    if (!githubId) return null

    // Look up the user and decrypt their PAT
    const db = getDb()
    const user = db.select().from(users).where(eq(users.githubId, githubId)).get()
    if (!user) return null

    const accessToken = decrypt(user.githubToken)

    return {
      accessToken,
      user: {
        githubId: user.githubId,
        name: user.name,
        image: user.avatarUrl,
        email: user.email,
      },
    }
  } catch {
    return null
  }
}

/**
 * Clear the session cookie.
 */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
