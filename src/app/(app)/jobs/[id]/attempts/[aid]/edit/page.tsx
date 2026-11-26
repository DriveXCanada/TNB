import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, isStaff, requireUser } from "@/lib/auth";
import { updateAttemptAction } from "@/app/actions";
import { getSettings } from "@/lib/settings";
import { recipientOptions } from "@/lib/recipients";
import { jobAddresses } from "@/lib/jobAddresses";
import { jobNo } from "@/lib/labels";
import AttemptForm from "@/components/AttemptForm";

export default async function EditAttemptPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const user = await requireUser();
  const { id, aid } = await params;
  const a = await prisma.attempt.findUnique({ where: { id: aid }, include: { job: true } });
  if (!a || a.jobId !== id || !canAccessJob(user, a.job) || (!isStaff(user) && a.serverId !== user.id)) notFound();
  const [{ recipients, mailOn }, settings] = await Promise.all([recipientOptions(a.job), getSettings()]);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="muted">Edit attempt · {jobNo(a.job.number)}</div>
        <h1 className="h1">{a.job.recipientName}</h1>
      </div>
      <AttemptForm
        action={updateAttemptAction.bind(null, a.id)}
        addresses={jobAddresses(a.job)}
        recipientType={a.job.recipientType}
        sharingOn={a.job.trackingEnabled}
        province={settings.province}
        recipients={recipients}
        mailOn={mailOn}
        returnTo={`/jobs/${id}`}
        defaults={{
          outcome: a.outcome,
          attemptedAt: a.attemptedAt.toISOString(),
          address: a.address,
          personServed: a.personServed ?? "",
          relationship: a.relationship ?? "",
          personDescription: a.personDescription ?? "",
          identifiedBy: a.identifiedBy ?? "",
          notes: a.notes ?? "",
          shareWithClient: a.shareWithClient,
        }}
      />
    </div>
  );
}
