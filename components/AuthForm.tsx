"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";

export default function AuthForm({
  action,
  mode,
  plan,
}: {
  action: (prev: AuthState, fd: FormData) => Promise<AuthState>;
  mode: "login" | "signup";
  plan?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as AuthState);
  return (
    <form action={formAction}>
      {state.error && <div className="alert error">{state.error}</div>}
      {mode === "signup" && plan && <input type="hidden" name="plan" value={plan} />}
      {mode === "signup" && (
        <>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required autoComplete="name" />
        </>
      )}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={mode === "signup" ? 10 : undefined}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />
      <div style={{ marginTop: 20 }}>
        <button className="btn big" disabled={pending} style={{ width: "100%" }}>
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </div>
    </form>
  );
}
