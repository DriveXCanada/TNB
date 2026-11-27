import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePortalUser } from "@/lib/portalAuth";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtDateTime, isServedOutcome, jobNo, OUTCOME_LABEL } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import AutoRefresh from "@/components/AutoRefresh";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export default async function PortalJob({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePortalUser();
  const { id } = await params;
  const job = await prisma.job.findFirst({
    // Scoped to this client: any other job id is simply not found.
    where: { id, clientId: u.clientId },
    include: {
      attempts: {
        where: { shareWithClient: true },
        orderBy: { attemptedAt: "desc" },
        include: { server: { select: { name: true } }, files: { where: { kind: "PHOTO" }, select: { id: true, mimeType: true, filename: true } } },
      },
      affidavits: { where: { clientVisible: true }, orderBy: { updatedAt: "desc" }, select: { id: true, kind: true, updatedAt: true } },
      files: { where: { kind: "DOCUMENT" }, select: { id: true, filename: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!job) notFound();
  const photos = (await getSettings()).sharePhotosWithClient === "true";

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={30} />
      <Link href="/portal" className="link text-sm">← All jobs</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Service of process · {jobNo(job.number)}</div>
          <h1 className="h1">{job.recipientName}</h1>
        </div>
        <StatusBadge status={job.status} attempts={job._count.attempts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="card">
          <h2 className="h2 mb-3 border-b-2 border-gold-500 pb-2">Attempts</h2>
          {job.attempts.length === 0 && <p className="muted">No attempts yet. This page updates automatically.</p>}
          <ol className="space-y-5 border-l-2 border-slate-200 pl-1">
            {job.attempts.map((a) => {
              const served = isServedOutcome(a.outcome);
              return (
                <li key={a.id} className="relative pl-6">
                  <span className={`absolute top-1.5 -left-[7px] h-3 w-3 rounded-full ring-4 ring-white ${served ? "bg-emerald-500" : "bg-gold-500"}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <div className={`font-bold ${served ? "text-emerald-700" : "text-navy-900"}`}>{OUTCOME_LABEL[a.outcome]}</div>
                    <div className="muted">{fmtDateTime(a.attemptedAt)}</div>
                  </div>
                  <div className="text-sm text-slate-600">{a.address}{a.server && ` · ${a.server.name}`}</div>
                  {a.personServed && <div className="text-sm">Served on: <b>{a.personServed}</b></div>}
                  {a.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{a.notes}</p>}
                  {a.latitude != null && a.longitude != null && (
                    <a className="link text-xs" target="_blank" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}>View GPS location</a>
                  )}
                  {photos && a.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.files.map((f) => (
                        <a key={f.id} href={`/api/files/${f.id}`} target="_blank">
                          {f.mimeType.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/files/${f.id}`} alt="Attempt photo" className="h-20 w-20 rounded-md border object-cover" />
                          ) : (
                            <span className="badge bg-slate-100 text-navy-800">{f.filename}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="h2 mb-3 border-b-2 border-gold-500 pb-2">Affidavits</h2>
            {job.affidavits.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {job.affidavits.map((af) => (
                  <li key={af.id}>
                    <a href={`/api/affidavits/${af.id}?download=1`} className="btn-accent w-full justify-between">
                      <span>{af.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service"}</span>
                      <span className="text-xs font-semibold">PDF ⬇</span>
                    </a>
                    <div className="mt-0.5 text-xs text-slate-500">{fmtDate(af.updatedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 className="h2 mb-2 border-b-2 border-gold-500 pb-2">Details</h2>
            <dl>
              <F label="Your file no.">{job.clientReference}</F>
              <F label="Court case">{job.courtFileNumber}</F>
              <F label="Plaintiff">{job.plaintiff}</F>
              <F label="Defendant">{job.defendant}</F>
              <F label="Court">{[job.courtName, job.courtCounty].filter(Boolean).join(", ")}</F>
              <F label="Court date">{fmtDate(job.courtDate)}</F>
              <F label="Address">{job.address}</F>
              <F label="Documents">{job.documentsServed}</F>
              <F label="Attempt due">{job.status !== "SERVED" ? fmtDate(job.dueDate) : null}</F>
              <F label="Served">{fmtDateTime(job.servedAt)}</F>
            </dl>
            {job.files.length > 0 && (
              <div className="mt-2 space-y-1">
                {job.files.map((f) => <a key={f.id} className="link block text-sm" href={`/api/files/${f.id}`} target="_blank">📄 {f.filename}</a>)}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
