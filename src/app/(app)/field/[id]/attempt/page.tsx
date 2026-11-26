import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requireUser } from "@/lib/auth";
import { createAttemptAction } from "@/app/actions";
import { getSettings } from "@/lib/settings";
import { recipientOptions } from "@/lib/recipients";
import { jobAddresses } from "@/lib/jobAddresses";
import { jobNo } from "@/lib/labels";
import AttemptForm from "@/components/AttemptForm";

export default async function NewAttemptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || !canAccessJob(user, job)) notFound();
  const [{ recipients, mailOn }, settings] = await Promise.all([recipientOptions(job), getSettings()]);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="muted">New attempt · {jobNo(job.number)}</div>
        <h1 className="h1">{job.recipientName}</h1>
      </div>
      <AttemptForm
        action={createAttemptAction.bind(null, job.id)}
        addresses={jobAddresses(job)}
        recipientType={job.recipientType}
        sharingOn={job.trackingEnabled}
        province={settings.province}
        recipients={recipients}
        mailOn={mailOn}
        returnTo={sp.from === "field" ? `/field/${job.id}` : `/jobs/${job.id}`}
      />
    </div>
  );
}
