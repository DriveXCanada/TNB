import type { Client, Job } from "@prisma/client";
import { fmtDate, statusText } from "@/lib/labels";
import { jobAddresses } from "@/lib/jobAddresses";

/** Read-only job sidebar shown next to the attempt form. */
export default function JobSummary({ job, attempts }: { job: Job & { client: Client | null }; attempts: number }) {
  const f = (label: string, v: React.ReactNode) =>
    v ? (
      <div className="grid grid-cols-[7rem_1fr] gap-2 py-0.5 text-sm">
        <dt className="text-slate-500">{label}</dt>
        <dd className="break-words whitespace-pre-wrap">{v}</dd>
      </div>
    ) : null;
  return (
    <aside className="card space-y-4 text-sm">
      <dl>
        {f("Status", statusText(job.status, attempts))}
        {f("Attempt due", fmtDate(job.dueDate) || "—")}
        {f("Court date", fmtDate(job.courtDate))}
      </dl>
      <div className="border-t border-slate-200 pt-3">
        <h3 className="mb-1 font-semibold">Recipient</h3>
        <dl>
          {f("Recipient", <b>{job.recipientName}</b>)}
          {f("Email", job.recipientEmail)}
          {f("Phone", job.recipientPhone && <a className="underline" href={`tel:${job.recipientPhone}`}>{job.recipientPhone}</a>)}
          {f("Description", job.recipientDescription)}
        </dl>
        {jobAddresses(job).map((a, i) => (
          <div key={a} className="mt-2 rounded-lg border border-slate-200 p-2">
            <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>{i === 0 ? "⌂ Home" : "Alternate"}</span>
              <a className="normal-case text-indigo-700" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`}>Navigate</a>
            </div>
            {a}
          </div>
        ))}
      </div>
      {job.instructions && (
        <div className="border-t border-slate-200 pt-3">
          <h3 className="mb-1 font-semibold">Service Instructions</h3>
          <p className="whitespace-pre-wrap">{job.instructions}</p>
        </div>
      )}
      {job.documentsServed && (
        <div className="border-t border-slate-200 pt-3">
          <h3 className="mb-1 font-semibold">Docs to Be Served</h3>
          <p className="whitespace-pre-wrap">{job.documentsServed}</p>
        </div>
      )}
      <div className="border-t border-slate-200 pt-3">
        <h3 className="mb-1 font-semibold">Court Case</h3>
        <dl>
          {f("Case", job.courtFileNumber)}
          {f("Plaintiff", job.plaintiff)}
          {f("Defendant", job.defendant)}
          {f("Filed", fmtDate(job.dateFiled))}
          {f("Court date", fmtDate(job.courtDate))}
          {f("Court", job.courtName)}
          {f("County", job.courtCounty)}
        </dl>
      </div>
    </aside>
  );
}
