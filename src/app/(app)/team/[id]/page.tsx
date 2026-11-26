import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveUserAction } from "@/app/actions";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  const u = isNew ? null : await prisma.user.findUnique({ where: { id } });
  if (!isNew && !u) notFound();
  const self = u?.id === me.id;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="h1">{isNew ? "Add person" : u!.name}</h1>
      <form action={saveUserAction.bind(null, isNew ? null : id)} className="card space-y-4">
        <div><label className="label">Full legal name (appears on affidavits) *</label><input className="input" name="name" required defaultValue={u?.name} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Email (login) *</label><input className="input" type="email" name="email" required defaultValue={u?.email} /></div>
          <div><label className="label">Phone</label><input className="input" name="phone" defaultValue={u?.phone ?? ""} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">City of residence (for affidavit)</label><input className="input" name="city" defaultValue={u?.city ?? ""} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" defaultValue={u?.role ?? "SERVER"} disabled={self}>
              <option value="SERVER">Process server – sees only their assigned jobs</option>
              <option value="MANAGER">Manager – sees and manages every job</option>
              <option value="ADMIN">Master – everything, plus team and settings</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">{isNew ? "Password *" : "New password (leave blank to keep)"}</label>
          <input className="input" type="password" name="password" minLength={8} required={isNew} autoComplete="new-password" />
        </div>
        {!self && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={u?.active ?? true} className="h-4 w-4" /> Active (can sign in)
          </label>
        )}
        <button className="btn-primary">Save</button>
      </form>
    </div>
  );
}
