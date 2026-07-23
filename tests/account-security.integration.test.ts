import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { changeUserEmail, changeUserPassword } from "@/lib/account-security";

const CURRENT_PW = "correct-horse-battery";
let userId: string;
let email: string;

beforeEach(async () => {
  email = `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com`;
  const user = await db.user.create({
    data: { name: "Test Owner", email, passwordHash: await hashPassword(CURRENT_PW), role: "OWNER" },
  });
  userId = user.id;
});

afterEach(async () => {
  await db.user.deleteMany({ where: { id: userId } });
});

describe("changeUserEmail", () => {
  it("rejects a wrong current password", async () => {
    const res = await changeUserEmail(userId, "nope", "new@test.example.com");
    expect(res.error).toMatch(/current password/i);
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.email).toBe(email);
  });

  it("rejects an invalid email", async () => {
    const res = await changeUserEmail(userId, CURRENT_PW, "not-an-email");
    expect(res.error).toMatch(/valid email/i);
  });

  it("rejects an email already in use by another user", async () => {
    const other = `taken-${Date.now()}@test.example.com`;
    const created = await db.user.create({
      data: { name: "Other", email: other, passwordHash: await hashPassword("x"), role: "OWNER" },
    });
    try {
      const res = await changeUserEmail(userId, CURRENT_PW, other.toUpperCase());
      expect(res.error).toMatch(/already in use/i);
    } finally {
      await db.user.delete({ where: { id: created.id } });
    }
  });

  it("rejects reusing the same email", async () => {
    const res = await changeUserEmail(userId, CURRENT_PW, email.toUpperCase());
    expect(res.error).toMatch(/already your login email/i);
  });

  it("changes the email (lowercased) on valid input", async () => {
    const next = `NEW-${Date.now()}@Test.Example.com`;
    const res = await changeUserEmail(userId, CURRENT_PW, next);
    expect(res.error).toBeUndefined();
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.email).toBe(next.toLowerCase());
  });
});

describe("changeUserPassword", () => {
  it("rejects a wrong current password", async () => {
    const res = await changeUserPassword(userId, "nope", "brand-new-pw-123", "brand-new-pw-123");
    expect(res.error).toMatch(/current password/i);
  });

  it("rejects a too-short new password", async () => {
    const res = await changeUserPassword(userId, CURRENT_PW, "short", "short");
    expect(res.error).toMatch(/at least 10/i);
  });

  it("rejects a mismatched confirmation", async () => {
    const res = await changeUserPassword(userId, CURRENT_PW, "brand-new-pw-123", "brand-new-pw-999");
    expect(res.error).toMatch(/don't match/i);
  });

  it("rejects reusing the current password", async () => {
    const res = await changeUserPassword(userId, CURRENT_PW, CURRENT_PW, CURRENT_PW);
    expect(res.error).toMatch(/different from your current/i);
  });

  it("changes the password on valid input", async () => {
    const next = "brand-new-pw-123";
    const res = await changeUserPassword(userId, CURRENT_PW, next, next);
    expect(res.error).toBeUndefined();
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(await verifyPassword(next, user!.passwordHash)).toBe(true);
    expect(await verifyPassword(CURRENT_PW, user!.passwordHash)).toBe(false);
  });
});
