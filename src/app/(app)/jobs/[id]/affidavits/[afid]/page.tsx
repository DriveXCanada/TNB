import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, canAccessJob, requireUser } from "@/lib/auth";
import { deleteAffidavitAction } from "@/app/actions";
import { fmtDateTime, jobNo } from "@/lib/labels";
import AffidavitViewer from "@/components/AffidavitViewer";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AffidavitPage({ params, searchParams }: { params: Promise<{ id: string; afid: string }>; searchParams: Promise<{ saved?: string; emailed?: string }> }) {
  const user = await requireUser();
  const { id, afid } = await params;
  const sp = await searchParams;
  const a = await prisma.affidavit.findUnique({
    where: { id: afid },
    select: { id: true, jobId: true, kind: true, createdAt: true, updatedAt: true, createdBy: { select: { name: true } }, job: true },
  });
  if (!a || a.jobId !== id || !canAccessJob(user, a.job)) notFound();
  const title = a.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service";
  return (
    <div className="space-y-4">
      {sp.saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Affidavit saved to the job and downloaded to this computer.</div>}
      {sp.emailed && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Emailed to {sp.emailed} recipient(s).</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/jobs/${id}`} className="text-sm text-indigo-700">← {jobNo(a.job.number)} · {a.job.recipientName}</Link>
          <h1 className="h1">{title}</h1>
          <div className="muted">Saved {fmtDateTime(a.updatedAt)}{a.createdBy && ` · created by ${a.createdBy.name}`}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "createAffidavits") && <Link className="btn-secondary" href={`/jobs/${id}/affidavits/${afid}/edit`}>Edit</Link>}
          {can(user, "emailSharing") && <Link className="btn-secondary" href={`/jobs/${id}/affidavits/${afid}/share`}>Email</Link>}
          {can(user, "deleteAffidavits") && (
            <form action={deleteAffidavitAction.bind(null, afid)}>
              <ConfirmButton className="btn-secondary text-rose-600" message="Delete this affidavit?">Delete</ConfirmButton>
            </form>
          )}
        </div>
      </div>
      <AffidavitViewer pdfUrl={`/api/affidavits/${afid}`} autoDownload={Boolean(sp.saved)} />
    </div>
  );
}
