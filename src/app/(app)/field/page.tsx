import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireUser } from "@/lib/auth";
import { fmtDate, jobNo } from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const where: Prisma.JobWhereInput = { archived: false, status: { in: ["PENDING", "IN_PROGRESS"] } };
  if (!isStaff(user) || !sp.all) where.serverId = user.id;
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
    include: { _count: { select: { attempts: true } }, server: true },
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">{sp.all ? "All open jobs" : "My jobs"}</h1>
        {isStaff(user) && (
          <Link className="text-sm font-semibold text-navy-600" href={sp.all ? "/field" : "/field?all=1"}>
            {sp.all ? "Show mine" : "Show all"}
          </Link>
        )}
      </div>
      {jobs.length === 0 && <div className="card muted">No open jobs assigned to you. 🎉</div>}
      <ul className="space-y-3">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link href={`/field/${j.id}`} className="card block active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{j.recipientName}</div>
                  <div className="text-sm text-slate-600">{j.address}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={j.status} attempts={j._count.attempts} /><PriorityBadge priority={j.priority} /></div>
              </div>
              <div className="muted mt-2">
                {jobNo(j.number)} · {j._count.attempts} attempt{j._count.attempts === 1 ? "" : "s"}
                {j.dueDate && <> · <span className={j.dueDate < new Date() ? "font-semibold text-rose-600" : ""}>due {fmtDate(j.dueDate)}</span></>}
                {sp.all && ` · ${j.server?.name ?? "unassigned"}`}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
