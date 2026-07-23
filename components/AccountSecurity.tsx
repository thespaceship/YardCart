"use client";

import { useActionState } from "react";
import { changeEmail, changePassword, type CredentialState } from "@/app/actions/security";

const EMPTY: CredentialState = {};

export default function AccountSecurity({ currentEmail }: { currentEmail: string }) {
  const [emailState, emailAction, emailPending] = useActionState(changeEmail, EMPTY);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, EMPTY);

  return (
    <div className="card">
      <h3>Account login</h3>
      <p className="muted">
        This is the email and password you sign in with — separate from the notification email
        above. Change either one below; you&apos;ll stay logged in.
      </p>

      <form action={emailAction} style={{ marginTop: 8 }}>
        <h4 style={{ marginBottom: 8 }}>Login email</h4>
        {emailState.error && <div className="alert error">{emailState.error}</div>}
        {emailState.ok && <div className="alert ok">✓ Login email updated.</div>}
        <p className="muted" style={{ marginTop: 0 }}>
          Current: <strong>{currentEmail}</strong>
        </p>
        <label htmlFor="ce-newEmail">New login email</label>
        <input
          id="ce-newEmail"
          name="newEmail"
          type="email"
          required
          autoComplete="email"
          defaultValue=""
        />
        <label htmlFor="ce-currentPassword">Current password</label>
        <input
          id="ce-currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <div style={{ marginTop: 16 }}>
          <button className="btn secondary" disabled={emailPending}>
            {emailPending ? "Saving…" : "Change email"}
          </button>
        </div>
      </form>

      <form action={pwAction} style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <h4 style={{ marginBottom: 8 }}>Password</h4>
        {pwState.error && <div className="alert error">{pwState.error}</div>}
        {pwState.ok && <div className="alert ok">✓ Password updated.</div>}
        <label htmlFor="cp-currentPassword">Current password</label>
        <input
          id="cp-currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <div className="field-row">
          <div>
            <label htmlFor="cp-newPassword">New password</label>
            <input
              id="cp-newPassword"
              name="newPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="cp-confirmPassword">Confirm new password</label>
            <input
              id="cp-confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>At least 10 characters.</p>
        <div style={{ marginTop: 16 }}>
          <button className="btn secondary" disabled={pwPending}>
            {pwPending ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
