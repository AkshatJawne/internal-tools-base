"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/kit/action-state";

export function ActionForm({ action, children, className }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
