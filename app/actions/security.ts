"use server";

import { revalidatePath } from "next/cache";
import { requireYardUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/observability";
import { changeUserEmail, changeUserPassword } from "@/lib/account-security";

export type CredentialState = { error?: string; ok?: boolean };

export async function changeEmail(
  _prev: CredentialState,
  formData: FormData
): Promise<CredentialState> {
  const { user } = await requireYardUser();
  if (!rateLimit(`change-email:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "");

  const result = await changeUserEmail(user.id, currentPassword, newEmail);
  if (result.error) return { error: result.error };

  await trackEvent("login_email_changed", { yardId: user.yardId, meta: { userId: user.id } });
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function changePassword(
  _prev: CredentialState,
  formData: FormData
): Promise<CredentialState> {
  const { user } = await requireYardUser();
  if (!rateLimit(`change-password:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const result = await changeUserPassword(user.id, currentPassword, newPassword, confirmPassword);
  if (result.error) return { error: result.error };

  await trackEvent("login_password_changed", { yardId: user.yardId, meta: { userId: user.id } });
  revalidatePath("/app/settings");
  return { ok: true };
}
