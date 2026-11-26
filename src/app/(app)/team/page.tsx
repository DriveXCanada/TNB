import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { ROLE_INFO } from "@/lib/permissions";
import { fmtDate } from "@/lib/labels";

export default async function TeamPage() {
  await requirePerm("manageEmployees");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { jobs: { where: { archived: false, status: { in: ["PENDING", "IN_PROGRESS"] } } } } } },
  });
  const soon = new Date(Date.now() + 30 * 86400000);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Employees</h1>
        <Link href="/team/new" className="btn-primary">+ New employee</Link>
      </div>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr><th className="th">Name</th><th className="th">Permissions</th><th className="th hidden md:table-cell">Email / phone</th><th className="th hidden sm:table-cell">License</th><th className="th">Open jobs</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="td">
                  <Link className="font-medium text-indigo-700" href={`/team/${u.id}`}>{u.name}</Link>
                  {u.defaultServer && <span className="badge ml-2 bg-indigo-50 text-indigo-700">Default server</span>}
                  <div className="text-xs text-slate-500">
                    {!u.active ? "Inactive" : u.role === "CONTACT" ? "Contact – no sign-in" : !u.passwordHash ? "Invitation pending" : ""}
                  </div>
                </td>
                <td className="td">{ROLE_INFO[u.role].label}</td>
                <td className="td hidden md:table-cell">{u.email}<div className="muted">{u.phone}</div></td>
                <td className="td hidden sm:table-cell">
                  {u.licenseNumber ?? "—"}
                  {u.licenseExpires && (
                    <div className={`text-xs ${u.licenseExpires < new Date() ? "font-semibold text-rose-600" : u.licenseExpires < soon ? "text-amber-700" : "text-slate-500"}`}>
                      {u.licenseExpires < new Date() ? "Expired" : "Expires"} {fmtDate(u.licenseExpires)}
                    </div>
                  )}
                </td>
                <td className="td"><Link className="text-indigo-700" href={`/jobs?status=open&server=${u.id}`}>{u._count.jobs}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
