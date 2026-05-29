import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Minimal middleware — no auth gate.
 * Mobster is a self-hosted single-user app.
 *
 * The only redirect: if not configured, /setup handles the onboarding.
 * All other routes are open.
 */
export function middleware(_request: NextRequest) {
  // Pass through all requests
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
