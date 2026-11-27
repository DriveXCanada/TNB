"use client";

import { useActionState, useRef, useEffect } from "react";

type State = { error?: string; ok?: string } | undefined;

/** "Add portal login" form for a client. */
export default function AddPortalUser({ action }: { action: (s: State, fd: FormData) => Promise<State> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={formAction} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" name="name" placeholder="Name" required />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <button className="btn-accent" disabled={pending}>{pending ? "Adding…" : "Add login"}</button>
      </div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-emerald-700">✓ {state.ok} An invitation was sent.</p>}
    </form>
  );
}
