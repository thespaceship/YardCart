"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/observability";

export type AuthState = { error?: string };

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
});

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(`signup:${await clientKey()}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    return { error: "Too many attempts. Try again later." };
  }
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists. Log in instead." };

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "OWNER" },
  });
  await trackEvent("signup", { meta: { userId: user.id } });
  await createSession(user.id);
  redirect("/app/onboarding");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(`login:${await clientKey()}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const user = await db.user.findUnique({ where: { email } });
  // constant-shape response to avoid user enumeration
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) return { error: "Invalid email or password." };

  await trackEvent("login", { yardId: user.yardId, meta: { userId: user.id } });
  await createSession(user.id);
  redirect(user.yardId ? "/app" : "/app/onboarding");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
