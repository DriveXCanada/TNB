import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requireUser } from "@/lib/auth";
import { emailAffidavitAction } from "@/app/actions";
import { recipientOptions } from "@/lib/recipients";
import { jobNo } from "@/lib/labels";
import EmailShare from "@/components/EmailShare";

export default async function ShareAffidavitPage({ params }: { params: Promise<{ id: string; afid: string }> }) {
  const user = await requireUser();
  const { id, afid } = await params;
  const a = await prisma.affidavit.findUnique({ where: { id: afid }, select: { jobId: true, kind: true, job: true } });
  if (!a || a.jobId !== id || !canAccessJob(user, a.job)) notFound();
  const { recipients, mailOn } = await recipientOptions(a.job);
  const title = a.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="muted">{jobNo(a.job.number)} · {a.job.recipientName}</div>
        <h1 className="h1">Share {title}</h1>
      </div>
      <form action={emailAffidavitAction.bind(null, afid)} className="card space-y-4">
        <p className="muted">The affidavit PDF will be attached.</p>
        <EmailShare recipients={recipients} mailOn={mailOn} />
        <div>
          <label className="label">Message (optional)</label>
          <textarea className="input" name="message" rows={3} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">Send email</button>
          <Link href={`/jobs/${id}/affidavits/${afid}`} className="btn-secondary">Skip</Link>
        </div>
      </form>
    </div>
  );
}
