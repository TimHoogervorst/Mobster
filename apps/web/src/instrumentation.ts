/**
 * Next.js Instrumentation Hook
 * Runs on server startup before any requests are handled.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeApp } = await import('@/lib/startup')
    await initializeApp()
  }
}
