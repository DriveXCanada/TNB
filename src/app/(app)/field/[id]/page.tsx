import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requireUser } from "@/lib/auth";
import { fmtDate, jobNo } from "@/lib/labels";
import AttemptCard from "@/components/AttemptCard";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

export default async function FieldJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ logged?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      attempts: { orderBy: { attemptedAt: "desc" }, include: { server: true, files: { select: { id: true, filename: true, mimeType: true } } } },
      files: { where: { kind: "DOCUMENT" }, select: { id: true, filename: true } },
    },
  });
  if (!job || !canAccessJob(user, job)) notFound();
  const addresses = [job.address, ...(job.altAddresses?.split("\n").map((s) => s.trim()).filter(Boolean) ?? [])];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {sp.logged && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Attempt saved{job.trackingEnabled ? " and shared with the client" : ""}.</div>}
      <div>
        <div className="muted">{jobNo(job.number)}{job.dueDate && ` · due ${fmtDate(job.dueDate)}`}</div>
        <h1 className="h1">{job.recipientName}</h1>
        <div className="mt-1 flex gap-2"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
      </div>

      <Link href={`/field/${job.id}/attempt`} className="btn-primary w-full py-4 text-lg">+ Log attempt</Link>

      <section className="card space-y-3">
        {addresses.map((addr, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="text-sm">{i > 0 && <span className="muted">Alt: </span>}{addr}</div>
            <a className="btn-secondary shrink-0" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`}>Navigate</a>
          </div>
        ))}
        {job.recipientDescription && <p className="text-sm"><b>Description:</b> {job.recipientDescription}</p>}
        {job.instructions && <p className="rounded-md bg-amber-50 p-2 text-sm whitespace-pre-wrap"><b>Instructions:</b> {job.instructions}</p>}
        {job.documentsServed && <p className="text-sm"><b>Documents:</b> {job.documentsServed}</p>}
        {job.files.map((f) => (
          <a key={f.id} className="block text-sm text-indigo-700 underline" href={`/api/files/${f.id}`} target="_blank">📄 {f.filename}</a>
        ))}
      </section>

      <section className="card">
        <h2 className="h2 mb-3">History</h2>
        {job.attempts.length === 0 && <p className="muted">No attempts yet.</p>}
        <ol className="space-y-5 border-l border-slate-200 pl-1">
          {job.attempts.map((a) => <AttemptCard key={a.id} a={a} />)}
        </ol>
      </section>
    </div>
  );
}
