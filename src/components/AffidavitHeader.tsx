import type { Client, Job, User } from "@prisma/client";
import { jobNo, statusText } from "@/lib/labels";

export default function AffidavitHeader({ job }: { job: Job & { client: Client | null; server: User | null; attempts: unknown[] } }) {
  return (
    <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
      <dl className="grid grid-cols-[4rem_1fr] gap-x-2">
        <dt className="text-slate-500">Job:</dt><dd className="font-semibold">{jobNo(job.number)}</dd>
        <dt className="text-slate-500">Status:</dt><dd>{statusText(job.status, job.attempts.length)}</dd>
      </dl>
      <dl className="grid grid-cols-[4rem_1fr] gap-x-2">
        <dt className="text-slate-500">Client:</dt><dd>{job.client?.name ?? "—"}</dd>
        <dt className="text-slate-500">Server:</dt><dd>{job.server?.name ?? "—"}</dd>
      </dl>
    </div>
  );
}
