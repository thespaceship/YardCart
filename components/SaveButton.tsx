"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms that confirms the save happened. While the action
 * runs it shows "Saving…" (disabled); when it finishes it flashes "✓ Saved" for a moment.
 * Reads the enclosing <form>'s state via useFormStatus, so it needs no changes to the action.
 * For actions that redirect on success the destination page's own confirmation shows instead.
 */
export default function SaveButton({
  children,
  className = "btn",
  savingLabel = "Saving…",
  savedLabel = "✓ Saved",
}: {
  children: ReactNode;
  className?: string;
  savingLabel?: string;
  savedLabel?: string;
}) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
    } else if (wasPending.current) {
      wasPending.current = false;
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [pending]);

  return (
    <button className={className} disabled={pending} aria-live="polite">
      {pending ? savingLabel : saved ? savedLabel : children}
    </button>
  );
}
