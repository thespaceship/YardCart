import { z } from "zod";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { sendEmail, emailShell, escapeHtml } from "./mailer";

/** Minimum login-password length — kept in sync with the signup rule in app/actions/auth.ts. */
export const PASSWORD_MIN = 10;

export type CredentialResult = { error?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(200);

/**
 * Change a user's login email. Requires the current password to confirm the change so an
 * open session can't silently take over the account. On success the OLD address is emailed
 * a "was this you?" notice. Callers must resolve `userId` from the session themselves — this
 * function trusts its `userId` argument and must never be exposed directly as a server action.
 */
export async function changeUserEmail(
  userId: string,
  currentPassword: string,
  newEmailRaw: string
): Promise<CredentialResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Account not found." };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  const parsed = emailSchema.safeParse(newEmailRaw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const newEmail = parsed.data;

  if (newEmail === user.email) {
    return { error: "That's already your login email." };
  }

  const taken = await db.user.findUnique({ where: { email: newEmail } });
  if (taken) return { error: "That email is already in use." };

  const oldEmail = user.email;
  await db.user.update({ where: { id: userId }, data: { email: newEmail } });

  await sendEmail({
    to: oldEmail,
    kind: "login_email_changed",
    subject: "Your YardCart login email was changed",
    html: emailShell(
      "Login email changed",
      `<p>The login email for your YardCart account was just changed from
        <strong>${escapeHtml(oldEmail)}</strong> to <strong>${escapeHtml(newEmail)}</strong>.</p>
       <p>If you made this change, no action is needed. If you didn't, contact us right away at
        <a href="mailto:support@getyardcart.com">support@getyardcart.com</a>.</p>`
    ),
  });

  return {};
}

/**
 * Change a user's login password. Requires the current password, enforces the minimum length,
 * and requires the confirmation field to match. On success the user is emailed a notice.
 * Callers must resolve `userId` from the session themselves — never expose this as a server action.
 */
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<CredentialResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Account not found." };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  if (newPassword.length < PASSWORD_MIN) {
    return { error: `New password must be at least ${PASSWORD_MIN} characters.` };
  }
  if (newPassword.length > 200) {
    return { error: "New password is too long." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation don't match." };
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return { error: "New password must be different from your current one." };
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await sendEmail({
    to: user.email,
    kind: "login_password_changed",
    subject: "Your YardCart password was changed",
    html: emailShell(
      "Password changed",
      `<p>The password for your YardCart account (<strong>${escapeHtml(user.email)}</strong>)
        was just changed.</p>
       <p>If you made this change, no action is needed. If you didn't, contact us right away at
        <a href="mailto:support@getyardcart.com">support@getyardcart.com</a>.</p>`
    ),
  });

  return {};
}
