"use client";

import { useState } from "react";
import Link from "next/link";
import { AFFIDAVIT_TEMPLATES, affidavitTitle, type AffidavitData, type AffidavitTemplate } from "@/lib/affidavitData";

const field = "w-full rounded bg-sky-50 px-1.5 py-1 text-sm outline-none ring-sky-300 focus:ring-2 [field-sizing:content]";

export default function AffidavitEditor({
  initial,
  statements,
  action,
  cancelHref,
  photos = [],
}: {
  initial: AffidavitData;
  statements: Record<AffidavitTemplate, string>;
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
  photos?: { id: string; caption: string }[];
}) {
  const [d, setD] = useState(initial);
  const set = <K extends keyof AffidavitData>(k: K, v: AffidavitData[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (k: keyof AffidavitData, rows = 1) => (
    <textarea className={`${field} resize-none`} rows={rows} value={String(d[k])} onChange={(e) => set(k, e.target.value as never)} />
  );
  const cell = (label: string, k: keyof AffidavitData) => (
    <div className="border border-slate-800 p-1.5">
      <div className="text-xs font-semibold">{label}</div>
      {text(k)}
    </div>
  );

  const switchTemplate = (t: AffidavitTemplate) =>
    setD((x) => ({
      ...x,
      template: t,
      // Swap the statement only if it hasn't been edited away from the other template's default.
      statement: x.statement === statements[x.template] ? statements[t] : x.statement,
    }));

  return (
    <form action={action}>
      <input type="hidden" name="data" value={JSON.stringify(d)} />
      <div className="sticky top-14 z-10 lg:top-0 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <Link href={cancelHref} className="btn-secondary">✕ Cancel</Link>
        <select className="input w-auto" value={d.template} onChange={(e) => switchTemplate(e.target.value as AffidavitTemplate)}>
          {AFFIDAVIT_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="input w-auto" value={d.kind} onChange={(e) => set("kind", e.target.value as AffidavitData["kind"])}>
          <option value="SERVICE">Affidavit of Service</option>
          <option value="NON_SERVICE">Affidavit of Non-Service</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn-accent px-6">Save</button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-4 shadow sm:p-10">
        <div className="mb-3 bg-slate-200 py-1 text-center font-semibold tracking-wide">{affidavitTitle(d)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {cell("Case:", "caseNo")}
          {cell("Court:", "court")}
          {cell("County:", "county")}
          {cell("Job:", "jobRef")}
        </div>
        <div className="grid sm:grid-cols-2">
          {cell("Plaintiff / Petitioner:", "plaintiff")}
          {cell("Defendant / Respondent:", "defendant")}
          {cell("Received by:", "receivedBy")}
          {cell("For:", "forClient")}
        </div>
        {cell("To be served upon:", "servedUpon")}

        <div className="mt-4">{text("statement", 3)}</div>

        <div className="mt-4 grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-start">
          <div className="pt-1 text-sm font-semibold">Recipient Name / Address:</div>{text("recipientAddress")}
          <div className="pt-1 text-sm font-semibold">Manner of Service:</div>{text("manner")}
          <div className="pt-1 text-sm font-semibold">Documents:</div>{text("documents")}
        </div>

        <div className="mt-4 text-sm font-semibold">Additional Comments:</div>
        {text("comments", 4)}

        <div className="mt-5 rounded-lg border-2 border-dashed border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              Photos to attach{" "}
              <span className="font-normal text-slate-500">
                (added after the affidavit as Exhibit &quot;{d.template === "ns" && d.kind === "SERVICE" ? "B" : "A"}&quot;, 2 per page)
              </span>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-3 text-xs">
                <button type="button" className="link" onClick={() => set("photoIds", photos.map((p) => p.id))}>Select all</button>
                <button type="button" className="link" onClick={() => set("photoIds", [])}>None</button>
              </div>
            )}
          </div>
          {photos.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No attempt photos on this job.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((p) => {
                const on = d.photoIds.includes(p.id);
                return (
                  <label key={p.id} title={p.caption} className={`relative cursor-pointer overflow-hidden rounded-md border-2 ${on ? "border-gold-500" : "border-transparent opacity-50"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${p.id}`} alt={p.caption} className="aspect-square w-full object-cover" />
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => set("photoIds", e.target.checked ? [...d.photoIds, p.id] : d.photoIds.filter((x) => x !== p.id))}
                      className="absolute top-1 left-1 h-5 w-5"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.includeFees} onChange={(e) => set("includeFees", e.target.checked)} className="h-4 w-4" /> Include fees?
        </label>
        {d.includeFees && <div className="mt-1">{text("fees")}</div>}

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="h-10 border-b border-slate-800" />
            <div className="mt-1 flex gap-2">
              <input className={field} value={d.deponent} onChange={(e) => set("deponent", e.target.value)} placeholder="Server name" />
              <span className="pt-1 text-sm font-semibold">Date</span>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.showNotary} onChange={(e) => set("showNotary", e.target.checked)} className="h-4 w-4" /> Display notary block?
            </label>
            {d.showNotary && (
              <>
                <textarea className={`${field} mt-1 resize-none italic`} rows={2} value={d.notaryText} onChange={(e) => set("notaryText", e.target.value)} />
                <div className="mt-6 border-b border-slate-800" />
                <div className="text-sm font-semibold">{d.template === "ns" ? d.commissionerTitle || "Signature of authority" : "Commissioner of Oaths"}</div>
                <div className="mt-6 border-b border-slate-800" />
                <div className="text-sm font-semibold">Date</div>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-500">The affidavit is automatically sized to fit on one page; photos go on the pages after it.</p>
        {d.template === "ns" && (
          <p className="mt-6 text-xs text-slate-500">The Nova Scotia layout adds the court heading, the Between: block, the &quot;Sworn to [or Affirmed] at…&quot; jurat and an Exhibit &quot;A&quot; line on the PDF.</p>
        )}
      </div>
    </form>
  );
}
