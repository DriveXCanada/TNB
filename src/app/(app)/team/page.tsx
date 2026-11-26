import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, ROLE_LABEL } from "@/lib/auth";

export default async function TeamPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { jobs: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } } } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Team</h1>
        <Link href="/team/new" className="btn-primary">+ Add person</Link>
      </div>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Role</th><th className="th hidden sm:table-cell">Email</th><th className="th">Open jobs</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="td"><Link className="font-medium text-indigo-700" href={`/team/${u.id}`}>{u.name}</Link>{!u.active && " (inactive)"}</td>
                <td className="td">{ROLE_LABEL[u.role]}</td>
                <td className="td hidden sm:table-cell">{u.email}</td>
                <td className="td"><Link className="text-indigo-700" href={`/jobs?status=open&server=${u.id}`}>{u._count.jobs}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
