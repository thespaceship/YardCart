import { db } from "./db";
import { logError } from "./observability";

/**
 * Email delivery. Default: TEST MAILBOX mode — emails are stored in the EmailLog
 * table and viewable at /app/mailbox. Set RESEND_API_KEY to send real email.
 */
export async function sendEmail(opts: {
  yardId?: string | null;
  to: string;
  subject: string;
  html: string;
  kind: string;
}): Promise<void> {
  const { yardId, to, subject, html, kind } = opts;
  const apiKey = process.env.RESEND_API_KEY;
  let sentVia = "TEST_MAILBOX";
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "YardCart <onboarding@resend.dev>",
          to,
          subject,
          html,
        }),
      });
      if (res.ok) sentVia = "RESEND";
      else await logError("mailer.resend", `Resend ${res.status}: ${await res.text()}`);
    } catch (e) {
      await logError("mailer.resend", e instanceof Error ? e.message : String(e));
    }
  }
  try {
    await db.emailLog.create({
      data: { yardId: yardId ?? null, toEmail: to, subject, html, kind, sentVia },
    });
  } catch (e) {
    await logError("mailer.log", e instanceof Error ? e.message : String(e));
  }
}

/** Escape user-provided text before interpolating into email HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f2;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;border:1px solid #e5e5e0">
    <h2 style="margin:0 0 16px;color:#1a2e1a">${title}</h2>
    ${bodyHtml}
    <p style="margin-top:32px;font-size:12px;color:#888">Sent via YardCart</p>
  </div></body></html>`;
}
