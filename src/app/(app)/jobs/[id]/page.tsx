import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { appUrl, mailEnabled } from "@/lib/mail";
import { fmtDate, fmtDateTime, jobNo, STATUS_LABEL } from "@/lib/labels";
import {
  assignServerAction,
  deleteAttemptAction,
  deleteFileAction,
  deleteJobAction,
  regenerateTrackingAction,
  setJobStatusAction,
  toggleAttemptShareAction,
  toggleTrackingAction,
} from "@/app/actions";
import AttemptCard from "@/components/AttemptCard";
import CopyButton from "@/components/CopyButton";
import ConfirmButton from "@/components/ConfirmButton";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [job, servers] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: {
        client: true,
        server: true,
        attempts: {
          orderBy: { attemptedAt: "desc" },
          include: { server: true, files: { select: { id: true, filename: true, mimeType: true } } },
        },
        files: { where: { kind: "DOCUMENT" }, select: { id: true, filename: true, size: true } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!job) notFound();
  const trackUrl = `${appUrl()}/track/${job.trackingToken}`;

  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
        <dt className="text-slate-500">{label}</dt>
        <dd className="col-span-2 whitespace-pre-wrap">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="muted">{jobNo(job.number)} · created {fmtDate(job.createdAt)}</div>
          <h1 className="h1">{job.recipientName}</h1>
          <div className="mt-1 flex gap-2"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" href={`/field/${job.id}/attempt`}>+ Log attempt</Link>
          <a className="btn-secondary" href={`/api/jobs/${job.id}/affidavit`} target="_blank">Affidavit PDF</a>
          <Link className="btn-secondary" href={`/jobs/${job.id}/edit`}>Edit</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h2 mb-2">Details</h2>
            <dl className="divide-y divide-slate-100">
              {row("Client", job.client && <>{job.client.name}{(job.client.contactName || job.client.email || job.client.phone) && <span className="block text-slate-500">{[job.client.contactName, job.client.email, job.client.phone].filter(Boolean).join(" · ")}</span>}</>)}
              {row("Client job no.", job.clientReference)}
              {row("Court case no.", job.courtFileNumber)}
              {row("Plaintiff", job.plaintiff)}
              {row("Defendant", job.defendant)}
              {row("Proceeding", !job.plaintiff && !job.defendant ? job.caseTitle : null)}
              {row("Court", [job.courtName, job.courtCounty && `${job.courtCounty} County`].filter(Boolean).join(", "))}
              {row("Date filed", fmtDate(job.dateFiled))}
              {row("Court date", fmtDate(job.courtDate))}
              {row("Documents", job.documentsServed)}
              {row("Party to serve", `${job.recipientName} (${job.recipientType.toLowerCase()})`)}
              {row("Email", job.recipientEmail && <a className="text-indigo-700" href={`mailto:${job.recipientEmail}`}>{job.recipientEmail}</a>)}
              {row("Phone", job.recipientPhone && <a className="text-indigo-700" href={`tel:${job.recipientPhone}`}>{job.recipientPhone}</a>)}
              {row("Service address", job.address)}
              {row("Alternate addresses", job.altAddresses)}
              {row("Description", job.recipientDescription)}
              {row("Attempt due", fmtDate(job.dueDate))}
              {row("Fee", job.fee ? `$${job.fee.toFixed(2)}` : null)}
              {row("Instructions", job.instructions)}
              {row("Served at", fmtDateTime(job.servedAt))}
            </dl>
            {job.files.length > 0 && (
              <div className="mt-3">
                <div className="label">Documents</div>
                <ul className="space-y-1">
                  {job.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between text-sm">
                      <a className="text-indigo-700 underline" href={`/api/files/${f.id}`} target="_blank">{f.filename}</a>
                      <form action={deleteFileAction.bind(null, f.id, job.id)}><button className="text-xs text-rose-600">Remove</button></form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="h2 mb-4">Attempts ({job.attempts.length})</h2>
            {job.attempts.length === 0 && <p className="muted">No attempts yet.</p>}
            <ol className="space-y-5 border-l border-slate-200 pl-1">
              {job.attempts.map((a) => (
                <AttemptCard key={a.id} a={a}>
                  <div className="mt-2 flex gap-3 text-xs">
                    <form action={toggleAttemptShareAction.bind(null, a.id, job.id)}>
                      <button className="text-indigo-700">{a.shareWithClient ? "Hide from client" : "Share with client"}</button>
                    </form>
                    <a className="text-indigo-700" href={`/api/jobs/${job.id}/affidavit?attempt=${a.id}`} target="_blank">Affidavit for this attempt</a>
                    <form action={deleteAttemptAction.bind(null, a.id, job.id)}><ConfirmButton className="text-rose-600" message="Delete this attempt?">Delete</ConfirmButton></form>
                  </div>
                </AttemptCard>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3">
            <h2 className="h2">Assignment</h2>
            <form action={assignServerAction.bind(null, job.id)} className="flex gap-2">
              <select className="input" name="serverId" defaultValue={job.serverId ?? ""}>
                <option value="">— Unassigned —</option>
                {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn-secondary">Save</button>
            </form>
            <form action={setJobStatusAction.bind(null, job.id)} className="flex gap-2">
              <select className="input" name="status" defaultValue={job.status}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn-secondary">Set</button>
            </form>
          </section>

          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="h2">Client live tracking</h2>
              <span className={`badge ${job.trackingEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                {job.trackingEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="muted">
              Send this link to your client. It updates live as attempts are logged and shows only attempts marked shared.
              {mailEnabled() ? " Notified emails also get a message for each shared attempt." : ""}
            </p>
            <input className="input text-xs" readOnly value={trackUrl} />
            <div className="flex flex-wrap gap-2">
              <CopyButton text={trackUrl} label="Copy link" />
              <a className="btn-secondary" href={trackUrl} target="_blank">Open</a>
              <form action={toggleTrackingAction.bind(null, job.id)}><button className="btn-secondary">{job.trackingEnabled ? "Disable" : "Enable"}</button></form>
              <form action={regenerateTrackingAction.bind(null, job.id)}><button className="btn-secondary" title="Old link stops working">New link</button></form>
            </div>
          </section>

          <section className="card">
            <form action={deleteJobAction.bind(null, job.id)}>
              <ConfirmButton className="btn-danger w-full" message="Delete this job and all its attempts and photos?">Delete job</ConfirmButton>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
