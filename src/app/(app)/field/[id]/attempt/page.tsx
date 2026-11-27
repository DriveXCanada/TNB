import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requirePerm } from "@/lib/auth";
import { createAttemptAction } from "@/app/actions";
import { attemptPageData } from "@/lib/attemptPage";
import { jobAddresses } from "@/lib/jobAddresses";
import { jobNo } from "@/lib/labels";
import AttemptForm from "@/components/AttemptForm";
import JobSummary from "@/components/JobSummary";

export default async function NewAttemptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const user = await requirePerm("createAttempts");
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || !canAccessJob(user, job)) notFound();
  const data = await attemptPageData(user, job);
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Job</div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{jobNo(job.number)}</h1>
          {job.courtFileNumber && <span className="badge bg-slate-100 text-slate-700">{job.courtFileNumber}</span>}
        </div>
        <div className="mt-1 eyebrow text-sm">New attempt · {job.recipientName}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <AttemptForm
          action={createAttemptAction.bind(null, job.id)}
          addresses={jobAddresses(job)}
          recipients={data.recipients}
          mailOn={data.mailOn}
          servers={data.servers}
          currentUserId={data.canChooseServer && job.serverId && data.servers.some((s) => s.id === job.serverId) ? job.serverId : user.id}
          canChooseServer={data.canChooseServer}
          canEmail={data.canEmail}
          sharingOn={job.trackingEnabled}
          returnTo={sp.from === "field" ? `/field/${job.id}` : `/jobs/${job.id}`}
        />
        <div><JobSummary job={data.jobWithClient} attempts={data.attempts} /></div>
      </div>
    </div>
  );
}
