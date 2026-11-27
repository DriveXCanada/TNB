import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, canAccessJob, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mail";
import { jobAddresses } from "@/lib/jobAddresses";
import { fmtDate, fmtDateTime, isServedOutcome, jobNo, OUTCOME_LABEL, STATUS_LABEL, statusText } from "@/lib/labels";
import {
  assignServerAction,
  deleteAttemptAction,
  deleteFileAction,
  deleteJobAction,
  regenerateTrackingAction,
  setJobStatusAction,
  toggleArchiveAction,
  toggleAttemptShareAction,
  toggleTrackingAction,
} from "@/app/actions";
import CopyButton from "@/components/CopyButton";
import ConfirmButton from "@/components/ConfirmButton";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-4 first:border-t-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-navy-900"><span className="h-4 w-1 rounded bg-gold-500" />{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-0.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ logged?: string; emailed?: string }> }) {
  const user = await requireUser();
  const staff = can(user, "manageJobs");
  const seeClient = staff || can(user, "manageClients");
  const canAttempt = can(user, "createAttempts");
  const canShare = can(user, "emailSharing");
  const canAffidavit = can(user, "createAffidavits");
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      client: true,
      server: true,
      createdBy: true,
      attempts: {
        orderBy: { attemptedAt: "desc" },
        include: { server: true, files: { select: { id: true, filename: true, mimeType: true } } },
      },
      files: { where: { kind: "DOCUMENT" }, select: { id: true, filename: true } },
      affidavits: { orderBy: { updatedAt: "desc" }, select: { id: true, kind: true, updatedAt: true, createdBy: { select: { name: true } } } },
    },
  });
  if (!job || !canAccessJob(user, job)) notFound();
  const [settings, servers] = await Promise.all([
    getSettings(),
    staff ? prisma.user.findMany({ where: { active: true, role: { not: "CONTACT" } }, orderBy: { name: "asc" } }) : [],
  ]);
  const trackUrl = `${appUrl()}/track/${job.trackingToken}`;
  const n = job.attempts.length;
  const addrs = jobAddresses(job);

  return (
    <div className="space-y-4">
      {sp.logged && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Attempt saved.</div>}
      {sp.emailed && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Emailed to {sp.emailed} recipient(s).</div>}
      {job.archived && <div className="rounded-lg bg-slate-200 p-3 text-sm font-medium text-slate-700">This job is archived.</div>}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Job</div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">{jobNo(job.number)}</h1>
            {job.courtFileNumber && <span className="badge bg-slate-100 text-slate-700">{job.courtFileNumber}</span>}
            <span className="badge bg-slate-100 text-slate-700">{n} Attempt{n === 1 ? "" : "s"}</span>
            {(job.status === "SERVED" || job.status === "NON_SERVICE" || job.status === "CANCELLED") && <StatusBadge status={job.status} />}
            <PriorityBadge priority={job.priority} />
          </div>
        </div>
        {staff && (
          <div className="flex items-center gap-2">
            <form action={toggleArchiveAction.bind(null, job.id)}><button className="btn-secondary">{job.archived ? "Unarchive" : "Archive"}</button></form>
            <Link className="btn-primary" href={`/jobs/${job.id}/edit`}>Edit</Link>
          </div>
        )}
      </div>

      {/* Client / Server / Status */}
      <div className="card grid gap-4 md:grid-cols-3">
        <div>
          <div className="eyebrow">Client</div>
          {job.client ? (
            <>
              {can(user, "manageClients") ? <Link href={`/clients/${job.client.id}`} className="link">{job.client.name}</Link> : <div className="font-semibold">{job.client.name}</div>}
              {job.client.contactName && <div className="text-sm">{job.client.contactName}</div>}
              {seeClient && job.client.email && <div className="text-sm text-slate-600">{job.client.email}</div>}
              {seeClient && job.client.phone && <div className="text-sm text-slate-600">{job.client.phone}</div>}
            </>
          ) : <div className="muted">No client</div>}
          {job.clientReference && <div className="mt-1 text-sm">Job no. <b>{job.clientReference}</b></div>}
        </div>
        <div>
          <div className="eyebrow">Server</div>
          <div className="font-semibold">{settings.companyName}</div>
          {job.server ? (
            <>
              <div className="text-sm">{job.server.name}</div>
              {job.server.phone && <a href={`tel:${job.server.phone}`} className="text-sm text-slate-600">{job.server.phone}</a>}
            </>
          ) : <div className="text-sm text-amber-700">Unassigned</div>}
          {staff && (
            <form action={assignServerAction.bind(null, job.id)} className="mt-2 flex gap-2">
              <select className="input py-1" name="serverId" defaultValue={job.serverId ?? ""}>
                <option value="">— Unassigned —</option>
                {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn-secondary py-1">Assign</button>
            </form>
          )}
        </div>
        <dl>
          <Field label="Status"><span className={job.status === "SERVED" ? "font-semibold text-emerald-700" : ""}>{statusText(job.status, n)}</span></Field>
          <Field label="Attempt due"><span className={job.dueDate && job.dueDate < new Date() && job.status !== "SERVED" ? "font-semibold text-rose-600" : ""}>{fmtDate(job.dueDate) || "—"}</span></Field>
          <Field label="Court date">{fmtDate(job.courtDate) || "—"}</Field>
          {job.servedAt && <Field label="Served">{fmtDateTime(job.servedAt)}</Field>}
          {staff && (
            <form action={setJobStatusAction.bind(null, job.id)} className="mt-2 flex gap-2">
              <select className="input py-1" name="status" defaultValue={job.status}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn-secondary py-1">Set</button>
            </form>
          )}
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="card space-y-0 py-1 sm:py-1">
          <Section
            title="Service Attempts"
            action={
              <div className="flex gap-2">
                <Link className="btn-secondary py-1.5" href={`/jobs/${job.id}/sheet`} target="_blank">Field Sheet</Link>
                {canAttempt && <Link className="btn-accent py-1.5" href={`/field/${job.id}/attempt`}>New Attempt</Link>}
              </div>
            }
          >
            {n === 0 && <p className="muted">No attempts yet.</p>}
            <ul className="divide-y divide-slate-100">
              {job.attempts.map((a) => {
                const served = isServedOutcome(a.outcome);
                const canEdit = staff || (canAttempt && a.serverId === user.id);
                return (
                  <li key={a.id} className="py-2">
                    <details className="group">
                      <summary className="grid cursor-pointer list-none gap-x-4 gap-y-0.5 sm:grid-cols-[1fr_1.2fr_auto]">
                        <div>
                          <div className={`font-medium ${served ? "text-emerald-700" : ""}`}>
                            <span className="mr-1 inline-block text-slate-400 group-open:rotate-45">⊕</span>
                            {OUTCOME_LABEL[a.outcome]}
                          </div>
                          <div className="text-xs text-slate-500">
                            {fmtDateTime(a.attemptedAt)}
                            {canEdit && <> · <Link className="underline" href={`/jobs/${job.id}/attempts/${a.id}/edit`}>Edit</Link></>}
                          </div>
                        </div>
                        <div className="text-sm">{a.address}</div>
                        <div className="text-right text-sm">
                          {canShare && <Link className="link" href={`/jobs/${job.id}/attempts/${a.id}/share`}>Share</Link>}
                          <div className="text-slate-600">{a.server?.name ?? "—"}</div>
                        </div>
                      </summary>
                      <div className="mt-2 space-y-1 rounded-md bg-slate-50 p-3 text-sm">
                        {a.personServed && <div>Person: <b>{a.personServed}</b>{a.relationship && ` (${a.relationship})`}</div>}
                        {a.personDescription && <div>Description: {a.personDescription}</div>}
                        {a.identifiedBy && <div>Identified by: {a.identifiedBy}</div>}
                        {a.notes && <div className="whitespace-pre-wrap">{a.notes}</div>}
                        {a.latitude != null && a.longitude != null && (
                          <a className="link" target="_blank" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}>
                            GPS {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}{a.gpsAccuracy ? ` (±${Math.round(a.gpsAccuracy)} m)` : ""}
                          </a>
                        )}
                        {a.files.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {a.files.map((f) => (
                              <div key={f.id} className="text-center">
                                <a href={`/api/files/${f.id}`} target="_blank">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {f.mimeType.startsWith("image/") ? <img src={`/api/files/${f.id}`} alt={f.filename} className="h-20 w-20 rounded-md border object-cover" /> : <span className="badge bg-white">{f.filename}</span>}
                                </a>
                                {staff && <form action={deleteFileAction.bind(null, f.id, job.id)}><ConfirmButton className="text-xs text-rose-600" message="Remove this photo?">Remove</ConfirmButton></form>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 pt-1 text-xs">
                          <span className={a.shareWithClient ? "text-emerald-700" : "text-slate-500"}>{a.shareWithClient ? "Visible on client tracking page" : "Hidden from client tracking page"}</span>
                          {staff && <form action={toggleAttemptShareAction.bind(null, a.id, job.id)}><button className="font-semibold text-navy-600">{a.shareWithClient ? "Hide" : "Show"}</button></form>}
                          {can(user, "deleteAttempts") && <form action={deleteAttemptAction.bind(null, a.id, job.id)}><ConfirmButton className="text-rose-600" message="Delete this attempt?">Delete</ConfirmButton></form>}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Affidavits" action={canAffidavit && <Link className="btn-accent py-1.5" href={`/jobs/${job.id}/affidavits/new`}>New Affidavit</Link>}>
            {job.affidavits.length === 0 ? (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">No Affidavits</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {job.affidavits.map((af) => (
                  <li key={af.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-2">
                    <Link className="font-medium font-semibold text-navy-600" href={`/jobs/${job.id}/affidavits/${af.id}`}>
                      {af.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service"}
                    </Link>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      {fmtDateTime(af.updatedAt)}{af.createdBy && ` · ${af.createdBy.name}`}
                      <a className="link" href={`/api/affidavits/${af.id}?download=1`}>Download</a>
                      {canAffidavit && <Link className="link" href={`/jobs/${job.id}/affidavits/${af.id}/edit`}>Edit</Link>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {staff && (
            <Section title="Client live tracking" action={<span className={`badge ${job.trackingEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{job.trackingEnabled ? "On" : "Off"}</span>}>
              <p className="muted mb-2">A private page for your client that updates as attempts are logged. It shows only attempts marked visible.</p>
              <input className="input mb-2 text-xs" readOnly value={trackUrl} />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={trackUrl} label="Copy link" />
                <a className="btn-secondary" href={trackUrl} target="_blank">Open</a>
                <form action={toggleTrackingAction.bind(null, job.id)}><button className="btn-secondary">{job.trackingEnabled ? "Disable" : "Enable"}</button></form>
                <form action={regenerateTrackingAction.bind(null, job.id)}><button className="btn-secondary" title="Old link stops working">New link</button></form>
              </div>
            </Section>
          )}
        </div>

        {/* Right column */}
        <aside className="card space-y-0 py-1 sm:py-1">
          <Section title="Recipient">
            <dl>
              <Field label="Recipient"><b>{job.recipientName}</b></Field>
              <Field label="Email">{job.recipientEmail && <a className="underline" href={`mailto:${job.recipientEmail}`}>{job.recipientEmail}</a>}</Field>
              <Field label="Phone">{job.recipientPhone && <a className="underline" href={`tel:${job.recipientPhone}`}>{job.recipientPhone}</a>}</Field>
              <Field label="Type">{job.recipientType.charAt(0) + job.recipientType.slice(1).toLowerCase()}</Field>
              <Field label="Description">{job.recipientDescription}</Field>
            </dl>
            {addrs.map((addr, i) => (
              <div key={addr} className="mt-2 rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between eyebrow">
                  <span>{i === 0 ? "⌂ Service address" : "Alternate"}</span>
                  <a className="normal-case font-semibold text-navy-600" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`}>Navigate</a>
                </div>
                {addr}
              </div>
            ))}
          </Section>
          <Section title="Service Instructions" action={staff && <Link className="text-sm font-semibold text-navy-600" href={`/jobs/${job.id}/edit`}>Edit</Link>}>
            <p className="text-sm whitespace-pre-wrap">{job.instructions || <span className="muted">None</span>}</p>
          </Section>
          <Section title="Docs to Be Served" action={staff && <Link className="text-sm font-semibold text-navy-600" href={`/jobs/${job.id}/edit`}>Edit</Link>}>
            <p className="text-sm whitespace-pre-wrap">{job.documentsServed || <span className="muted">None listed</span>}</p>
            {job.files.map((f) => (
              <div key={f.id} className="mt-1 flex items-center justify-between text-sm">
                <a className="link" href={`/api/files/${f.id}`} target="_blank">📄 {f.filename}</a>
                {staff && <form action={deleteFileAction.bind(null, f.id, job.id)}><ConfirmButton className="text-xs text-rose-600" message="Remove this document?">Remove</ConfirmButton></form>}
              </div>
            ))}
          </Section>
          <Section title="Court Case" action={staff && <Link className="text-sm font-semibold text-navy-600" href={`/jobs/${job.id}/edit`}>Edit</Link>}>
            <dl>
              <Field label="Case">{job.courtFileNumber}</Field>
              <Field label="Plaintiff">{job.plaintiff}</Field>
              <Field label="Defendant">{job.defendant}</Field>
              <Field label="Proceeding">{!job.plaintiff && !job.defendant ? job.caseTitle : null}</Field>
              <Field label="Filed">{fmtDate(job.dateFiled)}</Field>
              <Field label="Court date">{fmtDate(job.courtDate)}</Field>
              <Field label="Court">{job.courtName}</Field>
              <Field label="County">{job.courtCounty}</Field>
            </dl>
          </Section>
          <Section title="Details">
            <dl>
              <Field label="Job created">{fmtDate(job.createdAt)}</Field>
              <Field label="Created by">{job.createdBy?.name}</Field>
              <Field label="Last update">{fmtDate(job.updatedAt)}</Field>
              {staff && <Field label="Fee">{job.fee ? `$${job.fee.toFixed(2)}` : null}</Field>}
            </dl>
            {staff && (
              <form action={deleteJobAction.bind(null, job.id)} className="mt-3">
                <ConfirmButton className="text-sm text-rose-600" message="Delete this job and all its attempts and photos? Archiving keeps it instead.">Delete job</ConfirmButton>
              </form>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
