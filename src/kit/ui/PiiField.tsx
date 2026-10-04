"use client";

import { useState, useTransition } from "react";
import { revealPii } from "@/kit/pii-actions";

/** Masked by default. Revealing needs pii.reveal plus a typed reason, and is audited server-side. */
export function PiiField({ entityType, entityId, field, masked, canReveal }: { entityType: "KycCase" | "Record"; entityId: string; field: string; masked: string; canReveal: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (value !== null)
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{value}</span>
        <button type="button" className="text-xs text-ink-2 underline" onClick={() => setValue(null)}>hide</button>
      </span>
    );

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <span className="font-mono text-ink-2">{masked}</span>
        {canReveal && !asking && (
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => setAsking(true)}>Reveal</button>
        )}
      </span>
      {asking && (
        <span className="flex items-center gap-1">
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for access (audited)" className="w-56 rounded border border-line px-2 py-1 text-xs" />
          <button
            type="button"
            disabled={pending}
            className="rounded bg-ink px-2 py-1 text-xs text-white disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const res = await revealPii({ entityType, entityId, field, reason });
                if (res.error) setError(res.error);
                else {
                  setValue(res.value ?? "");
                  setAsking(false);
                  setError(null);
                }
              })
            }
          >
            Confirm
          </button>
          <button type="button" className="text-xs text-ink-2" onClick={() => setAsking(false)}>cancel</button>
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
