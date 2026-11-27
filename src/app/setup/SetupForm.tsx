"use client";
import { useActionState } from "react";
import { setupAction } from "../actions";

export default function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">Company name</label><input className="input" name="companyName" defaultValue="Vantage Security Consulting" /></div>
      <div><label className="label">Your name</label><input className="input" name="name" required /></div>
      <div><label className="label">Email</label><input className="input" name="email" type="email" required /></div>
      <div><label className="label">Password (min. 8 characters)</label><input className="input" name="password" type="password" minLength={8} required /></div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn-accent w-full py-3 text-base" disabled={pending}>Create account</button>
    </form>
  );
}
