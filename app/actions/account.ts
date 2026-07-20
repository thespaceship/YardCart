"use server";

import { redirect } from "next/navigation";
import { requireYardUser, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/observability";

export async function deleteAccount(formData: FormData): Promise<void> {
  const ctx = await requireYardUser();
  if (ctx.user.role !== "OWNER") {
    throw new Error("Only the account owner can delete this account.");
  }
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (confirmName !== ctx.yard.name) {
    throw new Error("Yard name didn't match — account not deleted.");
  }

  if (ctx.yard.planStatus === "ACTIVE") {
    await db.yard.update({ where: { id: ctx.yard.id }, data: { planStatus: "CANCELED" } });
  }

  await db.$transaction([
    db.user.deleteMany({ where: { yardId: ctx.yard.id } }),
    db.yard.delete({ where: { id: ctx.yard.id } }),
  ]);

  await trackEvent("account_deleted", { meta: { yardId: ctx.yard.id, userId: ctx.user.id } });
  await destroySession();
  redirect("/");
}
