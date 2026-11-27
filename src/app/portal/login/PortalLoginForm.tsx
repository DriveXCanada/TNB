"use client";
import { useActionState } from "react";
import { portalLoginAction } from "../actions";

export default function PortalLoginForm() {
  const [state, action, pending] = useActionState(portalLoginAction, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="name">Your name</label><input className="input" id="name" name="name" autoComplete="username" required /></div>
      <div>
        <label className="label" htmlFor="pin">PIN</label>
        <input className="input tracking-[.4em]" id="pin" name="pin" type="password" inputMode="numeric" pattern="\d*" maxLength={8} autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn-accent w-full py-3 text-base" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
