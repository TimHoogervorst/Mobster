interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * Simple in-memory rate limiter.
 *
 * @param key - Unique identifier for the client (e.g., session user ID)
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs - Time window in milliseconds
 * @returns Whether the request is allowed, and optional retry-after in seconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(key)

  // First request or window expired — create/reset
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  // Within window — increment
  entry.count++

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

/**
 * Clean up expired entries periodically.
 * Called on each rate limit check — lightweight enough for in-process use.
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000) // Every minute
