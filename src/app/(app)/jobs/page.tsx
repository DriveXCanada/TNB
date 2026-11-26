import Link from "next/link";
import type { Prisma, JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireUser } from "@/lib/auth";
import { fmtDate, jobNo, STATUS_LABEL } from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const staff = isStaff(user);
  const sp = await searchParams;
  const where: Prisma.JobWhereInput = { archived: sp.status === "archived" };
  if (!staff) where.serverId = user.id;
  if (sp.status === "open") where.status = { in: ["PENDING", "IN_PROGRESS"] };
  else if (sp.status && sp.status in STATUS_LABEL) where.status = sp.status as JobStatus;
  if (staff && sp.server === "none") where.serverId = null;
  else if (staff && sp.server) where.serverId = sp.server;
  if (sp.q) {
    const q = sp.q.trim();
    const n = Number(q.replace(/^J-?/i, ""));
    where.OR = [
      { recipientName: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { clientReference: { contains: q, mode: "insensitive" } },
      { plaintiff: { contains: q, mode: "insensitive" } },
      { defendant: { contains: q, mode: "insensitive" } },
      { courtFileNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
    ];
  }
  const [jobs, servers] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { client: true, server: true, _count: { select: { attempts: true } } },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">{staff ? "Jobs" : "My jobs"}</h1>
        {staff && <Link href="/jobs/new" className="btn-primary">+ New job</Link>}
      </div>
      <form className="card grid gap-3 sm:grid-cols-4">
        <input className="input sm:col-span-2" name="q" placeholder="Search name, plaintiff, defendant, address, job #, case #…" defaultValue={sp.q} />
        <select className="input" name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          <option value="open">Open (pending + in progress)</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="archived">Archived</option>
        </select>
        <div className="flex gap-2">
          <select className={`input ${staff ? "" : "hidden"}`} name="server" defaultValue={sp.server ?? ""}>
            <option value="">All servers</option>
            <option value="none">Unassigned</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-secondary">Filter</button>
        </div>
      </form>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Job</th><th className="th">Recipient</th><th className="th hidden md:table-cell">Client</th>
              <th className="th hidden md:table-cell">Server</th><th className="th">Due</th><th className="th">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-slate-50">
                <td className="td whitespace-nowrap"><Link href={`/jobs/${j.id}`} className="font-medium text-indigo-700">{jobNo(j.number)}</Link></td>
                <td className="td">
                  <Link href={`/jobs/${j.id}`} className="font-medium text-indigo-700">{j.recipientName}</Link>
                  {j.courtFileNumber && <span className="muted"> · {j.courtFileNumber}</span>}
                  <div className="muted max-w-xs truncate">{j.address}</div>
                </td>
                <td className="td hidden md:table-cell">{j.client?.name ?? "—"}<div className="muted">{j.clientReference}</div></td>
                <td className="td hidden md:table-cell">{j.server?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
                <td className="td whitespace-nowrap">{fmtDate(j.dueDate) || "—"} <PriorityBadge priority={j.priority} /></td>
                <td className="td"><StatusBadge status={j.status} /><div className="muted">{j._count.attempts} attempt{j._count.attempts === 1 ? "" : "s"}</div></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td className="td muted" colSpan={6}>No jobs found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
