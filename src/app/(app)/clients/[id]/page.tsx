import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { deleteClientAction, saveClientAction } from "@/app/actions";
import ConfirmButton from "@/components/ConfirmButton";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("manageClients");
  const { id } = await params;
  const isNew = id === "new";
  const c = isNew ? null : await prisma.client.findUnique({ where: { id } });
  if (!isNew && !c) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="h1">{isNew ? "New client" : c!.name}</h1>
      <form action={saveClientAction.bind(null, isNew ? null : id)} className="card space-y-4">
        <div><label className="label">Firm / client name *</label><input className="input" name="name" required defaultValue={c?.name} /></div>
        <div><label className="label">Contact person</label><input className="input" name="contactName" defaultValue={c?.contactName ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Email (gets attempt updates)</label><input className="input" type="email" name="email" defaultValue={c?.email ?? ""} /></div>
          <div><label className="label">Phone</label><input className="input" name="phone" defaultValue={c?.phone ?? ""} /></div>
        </div>
        <div><label className="label">Address</label><textarea className="input" rows={2} name="address" defaultValue={c?.address ?? ""} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={3} name="notes" defaultValue={c?.notes ?? ""} /></div>
        <button className="btn-primary">Save</button>
      </form>
      {!isNew && (
        <form action={deleteClientAction.bind(null, id)}>
          <ConfirmButton className="btn-danger" message="Delete this client? Their jobs will be kept but unlinked.">Delete client</ConfirmButton>
        </form>
      )}
    </div>
  );
}
