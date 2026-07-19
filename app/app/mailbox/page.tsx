import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Mailbox" };

export default async function MailboxPage() {
  const ctx = await requireYardUser();
  const emails = await db.emailLog.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const testMode = !process.env.RESEND_API_KEY;

  return (
    <div className="stack">
      <h1>Outbound mailbox</h1>
      {testMode && (
        <div className="alert info">
          <strong>Test mode:</strong> emails are captured here instead of being sent. Connect an
          email provider in production to deliver them (see Settings → docs).
        </div>
      )}
      {emails.length === 0 && <p className="muted">No emails yet.</p>}
      {emails.map((e) => (
        <details className="card" key={e.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{e.subject}</strong>{" "}
            <span className="muted">
              → {e.toEmail} · {e.createdAt.toLocaleString("en-US")} ·{" "}
              {e.sentVia === "TEST_MAILBOX" ? "not sent (test)" : "sent"}
            </span>
          </summary>
          <iframe
            srcDoc={e.html}
            style={{ width: "100%", height: 380, border: "1px solid var(--line)", borderRadius: 8, marginTop: 12, background: "#fff" }}
            title={e.subject}
            sandbox=""
          />
        </details>
      ))}
    </div>
  );
}
