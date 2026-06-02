import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Minimal middleware — no auth gate.
 * Mobster is a self-hosted single-user app.
 *
 * The only redirect: if not configured, /setup handles the onboarding.
 * All other routes are open.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Let the root layout know this is the standalone API docs page
  if (request.nextUrl.pathname === '/api-docs') {
    response.headers.set('x-is-api-docs', '1')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
