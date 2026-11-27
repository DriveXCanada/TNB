import type { Attempt, File as DbFile, User } from "@prisma/client";
import { fmtDateTime, isServedOutcome, OUTCOME_LABEL } from "@/lib/labels";

export type AttemptWithExtras = Attempt & { server: User | null; files: Pick<DbFile, "id" | "filename" | "mimeType">[] };

export default function AttemptCard({ a, children }: { a: AttemptWithExtras; children?: React.ReactNode }) {
  const served = isServedOutcome(a.outcome);
  return (
    <li className="relative pl-6">
      <span className={`absolute top-1.5 left-0 h-3 w-3 rounded-full ${served ? "bg-emerald-500" : "bg-amber-400"}`} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className={`font-semibold ${served ? "text-emerald-700" : ""}`}>{OUTCOME_LABEL[a.outcome]}</div>
        <div className="muted">{fmtDateTime(a.attemptedAt)}</div>
      </div>
      <div className="muted">{a.address} · by {a.server?.name ?? "—"}</div>
      {(a.personServed || a.relationship) && (
        <div className="mt-1 text-sm">
          Person: <b>{a.personServed}</b>
          {a.relationship && ` (${a.relationship})`}
        </div>
      )}
      {a.personDescription && <div className="text-sm">Description: {a.personDescription}</div>}
      {a.identifiedBy && <div className="text-sm">Identified by: {a.identifiedBy}</div>}
      {a.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{a.notes}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {a.latitude != null && a.longitude != null && (
          <a className="link" target="_blank" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}>
            GPS {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
            {a.gpsAccuracy ? ` (±${Math.round(a.gpsAccuracy)} m)` : ""}
          </a>
        )}
        {!a.shareWithClient && <span className="badge bg-slate-200 text-slate-600">Internal only</span>}
      </div>
      {a.files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {a.files.map((f) => (
            <a key={f.id} href={`/api/files/${f.id}`} target="_blank">
              {f.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${f.id}`} alt={f.filename} className="h-20 w-20 rounded-md border object-cover" />
              ) : (
                <span className="badge bg-slate-100">{f.filename}</span>
              )}
            </a>
          ))}
        </div>
      )}
      {children}
    </li>
  );
}
