import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, canAccessJob, requireUser } from "@/lib/auth";
import { updateAttemptAction } from "@/app/actions";
import { attemptPageData } from "@/lib/attemptPage";
import { jobAddresses } from "@/lib/jobAddresses";
import { jobNo } from "@/lib/labels";
import AttemptForm from "@/components/AttemptForm";
import JobSummary from "@/components/JobSummary";

export default async function EditAttemptPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const user = await requireUser();
  const { id, aid } = await params;
  const a = await prisma.attempt.findUnique({ where: { id: aid }, include: { job: true } });
  if (!a || a.jobId !== id || !canAccessJob(user, a.job) || !(can(user, "manageJobs") || (can(user, "createAttempts") && a.serverId === user.id))) notFound();
  const data = await attemptPageData(user, a.job);
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Job</div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{jobNo(a.job.number)}</h1>
        <div className="mt-1 eyebrow text-sm">Edit attempt · {a.job.recipientName}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <AttemptForm
          action={updateAttemptAction.bind(null, a.id)}
          addresses={jobAddresses(a.job)}
          servers={data.servers}
          currentUserId={user.id}
          canChooseServer={data.canChooseServer}
          sharingOn={a.job.trackingEnabled}
          returnTo={`/jobs/${id}`}
          defaults={{
            outcome: a.outcome,
            attemptedAt: a.attemptedAt.toISOString(),
            address: a.address,
            serverId: a.serverId ?? "",
            personServed: a.personServed ?? "",
            personDescription: a.personDescription ?? "",
            identifiedBy: a.identifiedBy ?? "",
            notes: a.notes ?? "",
            shareWithClient: a.shareWithClient,
          }}
        />
        <div><JobSummary job={data.jobWithClient} attempts={data.attempts} /></div>
      </div>
    </div>
  );
}
