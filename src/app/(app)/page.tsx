import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, jobNo, OUTCOME_LABEL } from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

export default async function Dashboard() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/jobs");

  const open = { archived: false, status: { in: ["PENDING", "IN_PROGRESS"] as ("PENDING" | "IN_PROGRESS")[] } };
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [openCount, unassigned, overdue, servedWeek, dueSoon, recent] = await Promise.all([
    prisma.job.count({ where: open }),
    prisma.job.count({ where: { ...open, serverId: null } }),
    prisma.job.count({ where: { ...open, dueDate: { lt: new Date() } } }),
    prisma.job.count({ where: { status: "SERVED", servedAt: { gte: weekAgo } } }),
    prisma.job.findMany({
      where: open,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 8,
      include: { server: true },
    }),
    prisma.attempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { job: true, server: true },
    }),
  ]);

  const stats = [
    ["Open jobs", openCount, "/jobs?status=open"],
    ["Unassigned", unassigned, "/jobs?status=open&server=none"],
    ["Overdue", overdue, "/jobs?status=open"],
    ["Served (7 days)", servedWeek, "/jobs?status=SERVED"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Dashboard</h1>
        <Link href="/jobs/new" className="btn-primary">+ New job</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, n, href]) => (
          <Link key={label} href={href} className="card hover:border-indigo-300">
            <div className="muted">{label}</div>
            <div className={`mt-1 text-3xl font-bold ${label === "Overdue" && n > 0 ? "text-rose-600" : ""}`}>{n}</div>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-3">Due next</h2>
          {dueSoon.length === 0 && <p className="muted">No open jobs.</p>}
          <ul className="divide-y divide-slate-100">
            {dueSoon.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{j.recipientName} <span className="muted">· {jobNo(j.number)}</span></div>
                    <div className="muted truncate">{j.server?.name ?? "Unassigned"} · {j.address}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PriorityBadge priority={j.priority} />
                    <span className={`text-xs ${j.dueDate && j.dueDate < new Date() ? "font-semibold text-rose-600" : "text-slate-500"}`}>
                      {j.dueDate ? `Due ${fmtDate(j.dueDate)}` : "No due date"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="h2 mb-3">Latest attempts</h2>
          {recent.length === 0 && <p className="muted">No attempts logged yet.</p>}
          <ul className="divide-y divide-slate-100">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/jobs/${a.jobId}`} className="block py-2.5 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{a.job.recipientName}</span>
                    <StatusBadge status={a.job.status} />
                  </div>
                  <div className="muted">{OUTCOME_LABEL[a.outcome]} · {a.server?.name ?? "—"} · {fmtDateTime(a.attemptedAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
