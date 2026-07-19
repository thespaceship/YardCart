/**
 * Simple in-memory fixed-window rate limiter. Suitable for a single-instance
 * deployment (Fly.io machine / single Vercel region with low traffic).
 * For multi-instance scale, swap for Upstash Redis — interface stays the same.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (b.count >= opts.limit) return false;
  b.count += 1;
  return true;
}

// prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  buckets.forEach((v, k) => {
    if (v.resetAt < now) buckets.delete(k);
  });
}, 60_000).unref?.();
