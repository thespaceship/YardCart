import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "yc_session";
const SESSION_DAYS = 14;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be set (>=32 chars)");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  yardId: string | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 11);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = payload.uid as string;
    if (!uid) return null;
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      yardId: user.yardId,
    };
  } catch {
    return null;
  }
}

/**
 * Require a logged-in user with a yard. Redirects to /login when logged out and
 * to /app/onboarding when the account has no yard yet.
 */
export async function requireYardUser(): Promise<{
  user: SessionUser;
  yard: NonNullable<Awaited<ReturnType<typeof db.yard.findUnique>>>;
}> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.yardId) redirect("/app/onboarding");
  const yard = await db.yard.findUnique({ where: { id: user.yardId } });
  if (!yard) redirect("/app/onboarding");
  return { user, yard };
}
