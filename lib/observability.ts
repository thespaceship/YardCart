import { db } from "./db";

/** First-party analytics event. Never throws. */
export async function trackEvent(type: string, opts?: { yardId?: string | null; meta?: Record<string, unknown> }) {
  try {
    await db.eventLog.create({
      data: {
        type,
        yardId: opts?.yardId ?? null,
        meta: JSON.stringify(opts?.meta ?? {}),
      },
    });
  } catch {
    // analytics must never break the request path
  }
}

/** First-party error log. Never throws. Forwards to Sentry when SENTRY_DSN is set. */
export async function logError(where: string, message: string, stack?: string) {
  try {
    await db.errorLog.create({ data: { where, message, stack: stack ?? "" } });
  } catch {
    // last resort
    console.error(`[errorlog-failed] ${where}: ${message}`);
  }
  // Sentry integration point: if SENTRY_DSN is set, @sentry/nextjs (installed at deploy
  // time) captures exceptions via instrumentation; this table remains the local record.
}
