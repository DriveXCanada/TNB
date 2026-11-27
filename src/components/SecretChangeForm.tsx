"use client";

import { useActionState, useEffect, useRef } from "react";

type State = { error?: string; ok?: string } | null;

/** Change-password / change-PIN form: current value, new value, confirm. */
export default function SecretChangeForm({
  action,
  kind,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  kind: "password" | "pin";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const pin = kind === "pin";
  const props = pin
    ? { inputMode: "numeric" as const, pattern: "\\d*", maxLength: 8, minLength: 4, className: "input tracking-[.4em]" }
    : { minLength: 8, className: "input" };
  const word = pin ? "PIN" : "password";
  return (
    <form ref={form} action={formAction} className="space-y-4">
      <div><label className="label">Current {word}</label><input {...props} minLength={undefined} type="password" name="current" autoComplete="current-password" required /></div>
      <div><label className="label">New {word} {pin ? "(4–8 digits)" : "(min. 8 characters)"}</label><input {...props} type="password" name="password" autoComplete="new-password" required /></div>
      <div><label className="label">Confirm new {word}</label><input {...props} type="password" name="confirm" autoComplete="new-password" required /></div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-emerald-700">✓ {state.ok}</p>}
      <button className="btn-accent px-8 py-2.5" disabled={pending}>{pending ? "Saving…" : `Change ${word}`}</button>
    </form>
  );
}
