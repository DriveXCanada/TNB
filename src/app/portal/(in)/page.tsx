import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePortalUser } from "@/lib/portalAuth";
import { fmtDate, fmtDateTime, jobNo, OUTCOME_LABEL } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";

const OPEN = ["PENDING", "IN_PROGRESS"] as const;

export default async function PortalJobs({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const u = await requirePortalUser();
  const sp = await searchParams;
  const show = sp.show === "served" || sp.show === "all" ? sp.show : "open";
  const base: Prisma.JobWhereInput = { clientId: u.clientId };
  const where: Prisma.JobWhereInput = { ...base };
  if (show === "open") where.status = { in: [...OPEN] };
  if (show === "served") where.status = "SERVED";
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { recipientName: { contains: q, mode: "insensitive" } },
      { clientReference: { contains: q, mode: "insensitive" } },
      { courtFileNumber: { contains: q, mode: "insensitive" } },
      { defendant: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ];
  }
  const [jobs, openCount, servedCount, totalCount] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        _count: { select: { attempts: true } },
        attempts: { where: { shareWithClient: true }, orderBy: { attemptedAt: "desc" }, take: 1 },
      },
    }),
    prisma.job.count({ where: { ...base, status: { in: [...OPEN] } } }),
    prisma.job.count({ where: { ...base, status: "SERVED" } }),
    prisma.job.count({ where: base }),
  ]);
  const tabs = [
    { key: "open", label: "In progress", n: openCount, tone: "bg-navy-800 text-white" },
    { key: "served", label: "Served", n: servedCount, tone: "bg-emerald-600 text-white" },
    { key: "all", label: "All jobs", n: totalCount, tone: "bg-gold-500 text-navy-950" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">{u.client.name}</div>
        <h1 className="h1">Your jobs</h1>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal?show=${t.key}`}
            className={`rounded-xl p-3 shadow-sm transition sm:p-4 ${t.tone} ${show === t.key ? "ring-4 ring-gold-300" : "opacity-80 hover:opacity-100"}`}
          >
            <div className="text-[11px] font-bold tracking-wider uppercase opacity-80">{t.label}</div>
            <div className="text-3xl font-extrabold">{t.n}</div>
          </Link>
        ))}
      </div>
      <form className="flex gap-2">
        <input type="hidden" name="show" value={show} />
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search name, your file no., court case, address…" />
        <button className="btn-primary">Search</button>
      </form>
      <ul className="space-y-3">
        {jobs.map((j) => {
          const last = j.attempts[0];
          return (
            <li key={j.id}>
              <Link href={`/portal/jobs/${j.id}`} className="card block border-l-4 border-l-navy-800 transition hover:border-l-gold-500 hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-navy-900">{j.recipientName}</div>
                    <div className="text-sm font-semibold text-navy-600">
                      {j.clientReference ? `Your file ${j.clientReference}` : jobNo(j.number)}
                      {j.courtFileNumber && ` · ${j.courtFileNumber}`}
                    </div>
                  </div>
                  <StatusBadge status={j.status} attempts={j._count.attempts} />
                </div>
                <div className="mt-1 text-sm text-slate-600">{j.address}</div>
                <div className="muted mt-1">
                  {last ? `Latest: ${OUTCOME_LABEL[last.outcome]} · ${fmtDateTime(last.attemptedAt)}` : "No attempts yet"}
                  {j.status !== "SERVED" && j.dueDate && ` · attempt due ${fmtDate(j.dueDate)}`}
                </div>
              </Link>
            </li>
          );
        })}
        {jobs.length === 0 && <li className="card muted">No jobs to show.</li>}
      </ul>
    </div>
  );
}
