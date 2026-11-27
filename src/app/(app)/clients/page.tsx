import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";

export default async function ClientsPage() {
  await requirePerm("manageClients");
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { jobs: true } } } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Clients</h1>
        <Link href="/clients/new" className="btn-accent">+ New client</Link>
      </div>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-navy-800"><tr><th className="th">Name</th><th className="th">Contact</th><th className="th hidden sm:table-cell">Email / phone</th><th className="th">Jobs</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="td"><Link className="font-medium font-semibold text-navy-600" href={`/clients/${c.id}`}>{c.name}</Link></td>
                <td className="td">{c.contactName}</td>
                <td className="td hidden sm:table-cell">{c.email}<div className="muted">{c.phone}</div></td>
                <td className="td"><Link className="font-semibold text-navy-600" href={`/jobs?q=${encodeURIComponent(c.name)}`}>{c._count.jobs}</Link></td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td className="td muted" colSpan={4}>No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
