import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import {
  addPortalUserAction,
  deleteClientAction,
  deletePortalUserAction,
  resendPortalInviteAction,
  saveClientAction,
  togglePortalUserAction,
} from "@/app/actions";
import { appUrl, mailEnabled } from "@/lib/mail";
import { fmtDate } from "@/lib/labels";
import AddPortalUser from "@/components/PortalAccess";
import ConfirmButton from "@/components/ConfirmButton";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("manageClients");
  const { id } = await params;
  const isNew = id === "new";
  const c = isNew ? null : await prisma.client.findUnique({ where: { id }, include: { portalUsers: { orderBy: { createdAt: "asc" } } } });
  if (!isNew && !c) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">{isNew ? "New client" : c!.name}</h1>
      <form action={saveClientAction.bind(null, isNew ? null : id)} className="card space-y-4">
        <div><label className="label">Firm / client name *</label><input className="input" name="name" required defaultValue={c?.name} /></div>
        <div><label className="label">Contact person</label><input className="input" name="contactName" defaultValue={c?.contactName ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Email</label><input className="input" type="email" name="email" defaultValue={c?.email ?? ""} /></div>
          <div><label className="label">Phone</label><input className="input" name="phone" defaultValue={c?.phone ?? ""} /></div>
        </div>
        <div><label className="label">Address</label><textarea className="input" rows={2} name="address" defaultValue={c?.address ?? ""} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={3} name="notes" defaultValue={c?.notes ?? ""} /></div>
        <button className="btn-primary">Save</button>
      </form>
      {!isNew && (
        <section className="card space-y-4">
          <div>
            <h2 className="h2">Client portal access</h2>
            <p className="muted">
              People added here can sign in at <span className="font-semibold text-navy-800">{appUrl()}/portal</span> and see only {c!.name}&apos;s jobs,
              the attempts you mark visible, and affidavits.
            </p>
          </div>
          {c!.portalUsers.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {c!.portalUsers.map((pu) => (
                <li key={pu.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 ${pu.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-navy-900">{pu.name}</div>
                    <div className="text-sm text-slate-600">{pu.email}</div>
                    <div className="text-xs text-slate-500">
                      {!pu.active ? "Access turned off" : !pu.passwordHash ? "Invitation sent – password not set yet" : pu.lastLoginAt ? `Last signed in ${fmtDate(pu.lastLoginAt)}` : "Password set"}
                    </div>
                    {pu.active && pu.inviteToken && !mailEnabled() && (
                      <input className="input mt-1 text-xs" readOnly value={`${appUrl()}/portal/invite/${pu.inviteToken}`} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {pu.active && (
                      <form action={resendPortalInviteAction.bind(null, pu.id)}>
                        <button className="btn-secondary py-1">{pu.passwordHash ? "Send password reset" : "Resend invite"}</button>
                      </form>
                    )}
                    <form action={togglePortalUserAction.bind(null, pu.id)}>
                      <button className="btn-secondary py-1">{pu.active ? "Turn off" : "Turn on"}</button>
                    </form>
                    <form action={deletePortalUserAction.bind(null, pu.id)}>
                      <ConfirmButton className="py-1 font-semibold text-rose-600" message={`Remove portal access for ${pu.name}?`}>Remove</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AddPortalUser action={addPortalUserAction.bind(null, id)} />
          {!mailEnabled() && <p className="text-xs text-amber-700">Email isn&apos;t set up yet, so copy each invitation link above and send it yourself.</p>}
        </section>
      )}
      {!isNew && (
        <form action={deleteClientAction.bind(null, id)}>
          <ConfirmButton className="btn-danger" message="Delete this client? Their jobs will be kept but unlinked.">Delete client</ConfirmButton>
        </form>
      )}
    </div>
  );
}
