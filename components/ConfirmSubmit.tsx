"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A submit button that pops a confirmation dialog before it actually submits its form — so a
 * single stray click can't trigger a charge (plan change) or a destructive action (delete). On
 * confirm it calls requestSubmit() on the enclosing <form>, running the server action normally
 * with all its fields (e.g. the hidden `plan`, or the delete-account name). Any native field
 * validation is enforced before the dialog opens, so the confirmation is the last step, not a
 * detour around a still-invalid form.
 */
export default function ConfirmSubmit({
  label,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  className = "btn",
  confirmClassName = "btn",
  disabled = false,
  disabledLabel,
  style,
}: {
  label: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  confirmClassName?: string;
  disabled?: boolean;
  disabledLabel?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function requestOpen() {
    const form = btnRef.current?.closest("form");
    // Enforce any native field validation (e.g. the delete-account name match) before confirming.
    if (form && !form.reportValidity()) return;
    setOpen(true);
  }

  function confirm() {
    setOpen(false);
    btnRef.current?.closest("form")?.requestSubmit();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className}
        style={style}
        disabled={disabled}
        onClick={requestOpen}
      >
        {disabled && disabledLabel ? disabledLabel : label}
      </button>
      {open && (
        <div
          className="modal-overlay no-print"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>{title}</h3>
            <p className="muted" style={{ marginBottom: 20, whiteSpace: "pre-line" }}>
              {message}
            </p>
            <div className="modal-actions">
              <button ref={cancelRef} type="button" className="btn secondary" onClick={() => setOpen(false)}>
                {cancelLabel}
              </button>
              <button type="button" className={confirmClassName} onClick={confirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
