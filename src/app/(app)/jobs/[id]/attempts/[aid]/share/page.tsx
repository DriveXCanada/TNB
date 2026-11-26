import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requirePerm } from "@/lib/auth";
import { emailAttemptAction } from "@/app/actions";
import { recipientOptions } from "@/lib/recipients";
import { fmtDateTime, jobNo, OUTCOME_LABEL } from "@/lib/labels";
import EmailShare from "@/components/EmailShare";

export default async function ShareAttemptPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const user = await requirePerm("emailSharing");
  const { id, aid } = await params;
  const a = await prisma.attempt.findUnique({ where: { id: aid }, include: { job: true, _count: { select: { files: true } } } });
  if (!a || a.jobId !== id || !canAccessJob(user, a.job)) notFound();
  const { recipients, mailOn } = await recipientOptions(a.job);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="muted">Share attempt · {jobNo(a.job.number)}</div>
        <h1 className="h1">{a.job.recipientName}</h1>
      </div>
      <div className="card text-sm">
        <div className="font-semibold">{OUTCOME_LABEL[a.outcome]}</div>
        <div className="muted">{fmtDateTime(a.attemptedAt)} · {a.address}</div>
        {a._count.files > 0 && <div className="muted mt-1">{a._count.files} photo(s) will be attached.</div>}
      </div>
      <form action={emailAttemptAction.bind(null, a.id)} className="card space-y-4">
        <h2 className="h2">Email &amp; share</h2>
        <EmailShare recipients={recipients} mailOn={mailOn} />
        <div className="flex gap-2">
          <button className="btn-primary">Send email</button>
          <Link href={`/jobs/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
