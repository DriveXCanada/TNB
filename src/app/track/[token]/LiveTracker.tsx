"use client";

import { useEffect, useState } from "react";
import type { TrackingData } from "@/lib/tracking";

const POLL_MS = 15000;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  SERVED: "bg-emerald-100 text-emerald-800",
  NON_SERVICE: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-zinc-200 text-zinc-600",
};

export default function LiveTracker({ token, initial, timeZone }: { token: string; initial: NonNullable<TrackingData>; timeZone: string }) {
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(true);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/track/${token}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const next = (await res.json()) as NonNullable<TrackingData>;
        if (stop) return;
        setData((prev) => {
          const known = new Set(prev.attempts.map((a) => a.id));
          const added = next.attempts.filter((a) => !known.has(a.id)).map((a) => a.id);
          if (added.length) setFresh(new Set(added));
          return next;
        });
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [token]);

  const fmt = (s: string) => new Date(s).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone });
  const { job, company, attempts } = data;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="font-bold text-indigo-700">{company.name}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
          {online ? "Live" : "Reconnecting…"}
        </div>
      </header>

      <section className="card">
        <div className="muted">Service of process · {job.number}</div>
        <h1 className="h1">{job.recipientName}</h1>
        <div className="mt-2"><span className={`badge ${STATUS_STYLE[job.status]}`}>{job.statusLabel}</span></div>
        <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {job.clientName && <div><dt className="muted inline">Client: </dt><dd className="inline">{job.clientName}</dd></div>}
          {job.clientReference && <div><dt className="muted inline">Your ref.: </dt><dd className="inline">{job.clientReference}</dd></div>}
          {job.courtFileNumber && <div><dt className="muted inline">Court file: </dt><dd className="inline">{job.courtFileNumber}</dd></div>}
          {job.servedAt && <div><dt className="muted inline">Served: </dt><dd className="inline">{fmt(job.servedAt)}</dd></div>}
          <div className="sm:col-span-2"><dt className="muted inline">Address: </dt><dd className="inline">{job.address}</dd></div>
          {job.documentsServed && <div className="sm:col-span-2"><dt className="muted inline">Documents: </dt><dd className="inline">{job.documentsServed}</dd></div>}
        </dl>
      </section>

      <section className="card">
        <h2 className="h2 mb-4">Attempt history</h2>
        {attempts.length === 0 && <p className="muted">No attempts yet. This page updates automatically.</p>}
        <ol className="space-y-5 border-l border-slate-200 pl-1">
          {attempts.map((a) => (
            <li key={a.id} className={`relative rounded-md pl-6 transition-colors duration-[3000ms] ${fresh.has(a.id) ? "bg-indigo-50" : ""}`}>
              <span className={`absolute top-1.5 left-0 h-3 w-3 rounded-full ${a.served ? "bg-emerald-500" : "bg-amber-400"}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <div className={`font-semibold ${a.served ? "text-emerald-700" : ""}`}>{a.outcome}</div>
                <div className="muted">{fmt(a.attemptedAt)}</div>
              </div>
              <div className="muted">{a.address}{a.serverName && ` · ${a.serverName}`}</div>
              {a.personServed && <div className="text-sm">Served on: <b>{a.personServed}</b>{a.relationship && ` (${a.relationship})`}</div>}
              {a.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{a.notes}</p>}
              {a.gps && (
                <a className="text-xs text-indigo-700 underline" target="_blank" href={`https://www.google.com/maps?q=${a.gps.lat},${a.gps.lng}`}>
                  View GPS location
                </a>
              )}
              {a.photoUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.photoUrls.map((u) => (
                    <a key={u} href={u} target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Attempt photo" className="h-20 w-20 rounded-md border object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-center text-xs text-slate-500">
        Questions? {company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}
        {company.phone && company.email && " · "}
        {company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}
        <div className="mt-1">Last updated {fmt(data.updatedAt)}</div>
      </footer>
    </main>
  );
}
