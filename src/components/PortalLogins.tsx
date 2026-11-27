"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

type State = { error?: string; ok?: string } | undefined;
type Act = (s: State, fd: FormData) => Promise<State>;

const pinInput = "input tracking-[.3em]";

/** Add a portal login: name (used to sign in) + PIN. */
export function AddPortalLogin({ action }: { action: Act }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form
      ref={form}
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <input className="input" name="name" placeholder="Their name (used to sign in)" required />
        <input className={pinInput} name="pin" placeholder="PIN" inputMode="numeric" pattern="\d{4,8}" maxLength={8} required title="4 to 8 digits" />
        <button className="btn-accent" disabled={pending}>{pending ? "Adding…" : "Add login"}</button>
      </div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-emerald-700">✓ {state.ok}</p>}
    </form>
  );
}

/** Inline "Set new PIN" for an existing login (also unlocks it). */
export function SetPortalPin({ action }: { action: Act }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <span className="flex items-center gap-2">
        <button type="button" className="btn-secondary py-1" onClick={() => setOpen(true)}>Set new PIN</button>
        {state?.ok && <span className="text-xs font-semibold text-emerald-700">✓ {state.ok}</span>}
      </span>
    );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input className={`${pinInput} w-32 py-1`} name="pin" placeholder="New PIN" inputMode="numeric" pattern="\d{4,8}" maxLength={8} required autoFocus />
      <button className="btn-accent py-1" disabled={pending}>Save</button>
      <button type="button" className="text-sm text-slate-500" onClick={() => setOpen(false)}>Cancel</button>
      {state?.error && <span className="w-full text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}
