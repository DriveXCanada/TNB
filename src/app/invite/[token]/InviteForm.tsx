"use client";
import { useActionState } from "react";

export default function InviteForm({ action }: { action: (s: unknown, fd: FormData) => Promise<{ error: string } | undefined> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div><label className="label">Password (min. 8 characters)</label><input className="input" type="password" name="password" minLength={8} required autoComplete="new-password" /></div>
      <div><label className="label">Confirm password</label><input className="input" type="password" name="confirm" minLength={8} required autoComplete="new-password" /></div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>Set password &amp; sign in</button>
    </form>
  );
}
