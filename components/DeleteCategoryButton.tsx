"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Delete" button for a category row. It lives inside the row's upsert form but submits to a
 * different server action via a hidden submit button carrying `formAction` — ConfirmSubmit can't
 * do this because it always requestSubmit()s the form's default action. Pops a confirmation first
 * so a stray click can't wipe a category. Disabled (with a reason) while the category has products.
 */
export default function DeleteCategoryButton({
  action,
  name,
  blocked,
  blockedReason,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  blocked: boolean;
  blockedReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const hiddenRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn danger small"
        disabled={blocked}
        title={blocked ? blockedReason : undefined}
        onClick={() => setOpen(true)}
      >
        Delete
      </button>
      {/* Real submitter — clicking it posts the row form to `action` (hard delete). */}
      <button
        ref={hiddenRef}
        type="submit"
        formAction={action}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />
      {open && (
        <div
          className="modal-overlay no-print"
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${name}`}
          onClick={() => setOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Delete “{name}”?</h3>
            <p className="muted" style={{ marginBottom: 20 }}>
              This permanently removes the “{name}” category. This can’t be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setOpen(false);
                  hiddenRef.current?.click();
                }}
              >
                Delete category
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
