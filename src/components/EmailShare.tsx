"use client";

import { useState } from "react";
import type { Recipient } from "@/lib/recipients";

/** Checkbox list of who gets an emailed copy. Nothing is checked unless the user ticks it. */
export default function EmailShare({ recipients, mailOn }: { recipients: Recipient[]; mailOn: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const groups = ["Client", "Server", "My company"] as const;
  const box = (r: Recipient) => (
    <label key={r.email} className="flex items-center gap-2 py-1 text-sm">
      <input type="checkbox" name="emailTo" value={r.email} className="h-5 w-5" />
      <span>✉ {r.label}</span>
      {r.label !== r.email && <span className="truncate text-xs text-slate-400">{r.email}</span>}
    </label>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!mailOn && (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800 sm:col-span-2">
          Email isn&apos;t set up yet (SMTP settings), so nothing will actually be sent.
        </p>
      )}
      <div>
        <div className="label uppercase">Client</div>
        {recipients.filter((r) => r.group === "Client").map(box)}
        {recipients.every((r) => r.group !== "Client") && <p className="muted">No client email on file.</p>}
        <div className="label mt-3 uppercase">Other email</div>
        <input className="input" name="emailOther" placeholder="Send email to…" />
      </div>
      <div>
        {groups.slice(1).map((g) => {
          const list = recipients.filter((r) => r.group === g);
          if (!list.length) return null;
          const shown = g === "My company" && !showAll ? list.slice(0, 5) : list;
          return (
            <div key={g} className="mb-3">
              <div className="label uppercase">{g}</div>
              {shown.map(box)}
              {shown.length < list.length && (
                <button type="button" className="text-sm text-indigo-700" onClick={() => setShowAll(true)}>Show all ({list.length})</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
