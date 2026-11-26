import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requireUser } from "@/lib/auth";
import { createAttemptAction } from "@/app/actions";
import AttemptForm from "@/components/AttemptForm";

export default async function NewAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || !canAccessJob(user, job)) notFound();
  const addresses = [job.address, ...(job.altAddresses?.split("\n").map((s) => s.trim()).filter(Boolean) ?? [])];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="muted">Log attempt</div>
        <h1 className="h1">{job.recipientName}</h1>
      </div>
      <AttemptForm
        action={createAttemptAction.bind(null, job.id)}
        addresses={addresses}
        recipientType={job.recipientType}
        sharingOn={job.trackingEnabled}
      />
    </div>
  );
}
