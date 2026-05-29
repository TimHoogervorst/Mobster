'use server'

import { createSession } from '@/lib/auth'

interface LoginResult {
  success: boolean
  error?: string
}

export async function savePatToken(
  _prevState: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const token = (formData.get('token') as string)?.trim()

  if (!token) {
    return { success: false, error: 'Please enter a Personal Access Token.' }
  }

  // Basic format validation: GitHub PATs start with ghp_, github_pat_, or gho_
  if (
    !token.startsWith('ghp_') &&
    !token.startsWith('github_pat_') &&
    !token.startsWith('gho_')
  ) {
    return {
      success: false,
      error:
        'Invalid token format. GitHub Personal Access Tokens start with "ghp_", "github_pat_", or "gho_".',
    }
  }

  // Validate the token by fetching the authenticated user
  let githubUser: { id: number; login: string; name: string | null; avatar_url: string; email: string | null }
  try {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (userResponse.status === 401 || userResponse.status === 403) {
      return {
        success: false,
        error: 'GitHub rejected this token. Please check that it is valid and has not expired.',
      }
    }

    if (!userResponse.ok) {
      return {
        success: false,
        error: `GitHub API error (HTTP ${userResponse.status}). Please try again.`,
      }
    }

    githubUser = (await userResponse.json()) as any
  } catch {
    return {
      success: false,
      error: 'Could not reach GitHub. Please check your internet connection and try again.',
    }
  }

  // Create the session (encrypts token, stores in DB, sets cookie)
  await createSession(token, {
    id: String(githubUser.id),
    login: githubUser.login,
    name: githubUser.name,
    avatar_url: githubUser.avatar_url,
    email: githubUser.email,
  })

  return { success: true }
}

export async function disconnectPat(): Promise<void> {
  const { signOut } = await import('@/lib/auth')
  await signOut()
}
