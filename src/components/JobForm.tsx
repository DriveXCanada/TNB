import type { Client, Job, User } from "@prisma/client";
import { PRIORITY_LABEL } from "@/lib/labels";

export default function JobForm({
  action,
  job,
  clients,
  servers,
  defaultCourt,
}: {
  action: (fd: FormData) => Promise<void>;
  job?: Job;
  clients: Client[];
  servers: User[];
  defaultCourt: string;
}) {
  const due = job?.dueDate ? job.dueDate.toISOString().slice(0, 10) : "";
  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Recipient (party to be served)</h2>
        <div><label className="label">Name *</label><input className="input" name="recipientName" required defaultValue={job?.recipientName} /></div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="recipientType" defaultValue={job?.recipientType ?? "INDIVIDUAL"}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="CORPORATION">Corporation / business</option>
            <option value="GOVERNMENT">Government / agency</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Service address *</label><input className="input" name="address" required defaultValue={job?.address} placeholder="123 Main St, Toronto, ON M5V 1A1" /></div>
        <div className="sm:col-span-2"><label className="label">Alternate addresses (one per line)</label><textarea className="input" rows={2} name="altAddresses" defaultValue={job?.altAddresses ?? ""} /></div>
        <div className="sm:col-span-2"><label className="label">Description (age, appearance, vehicle…)</label><textarea className="input" rows={2} name="recipientDescription" defaultValue={job?.recipientDescription ?? ""} /></div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Court &amp; documents</h2>
        <div><label className="label">Court</label><input className="input" name="courtName" defaultValue={job?.courtName ?? defaultCourt} placeholder="Ontario Superior Court of Justice" /></div>
        <div><label className="label">Court file number</label><input className="input" name="courtFileNumber" defaultValue={job?.courtFileNumber ?? ""} /></div>
        <div className="sm:col-span-2"><label className="label">Title of proceeding</label><input className="input" name="caseTitle" defaultValue={job?.caseTitle ?? ""} placeholder="JANE DOE, Plaintiff – and – JOHN SMITH, Defendant" /></div>
        <div className="sm:col-span-2"><label className="label">Documents to be served</label><textarea className="input" rows={2} name="documentsServed" defaultValue={job?.documentsServed ?? ""} placeholder="Statement of Claim issued January 5, 2026" /></div>
        <div className="sm:col-span-2"><label className="label">Upload documents (PDF, images)</label><input className="input" type="file" name="documents" multiple /></div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Client &amp; assignment</h2>
        <div>
          <label className="label">Client</label>
          <select className="input" name="clientId" defaultValue={job?.clientId ?? ""}>
            <option value="">— None —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Client reference / file #</label><input className="input" name="clientReference" defaultValue={job?.clientReference ?? ""} /></div>
        <div className="sm:col-span-2">
          <label className="label">Extra emails to notify on each attempt (comma-separated)</label>
          <input className="input" name="notifyEmails" defaultValue={job?.notifyEmails ?? ""} placeholder="clerk@lawfirm.ca" />
        </div>
        <div>
          <label className="label">Assigned server</label>
          <select className="input" name="serverId" defaultValue={job?.serverId ?? ""}>
            <option value="">— Unassigned —</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" name="priority" defaultValue={job?.priority ?? "ROUTINE"}>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="label">Due date</label><input className="input" type="date" name="dueDate" defaultValue={due} /></div>
        <div><label className="label">Fee (CAD)</label><input className="input" type="number" step="0.01" min="0" name="fee" defaultValue={job?.fee?.toString() ?? ""} /></div>
        <div className="sm:col-span-2"><label className="label">Instructions for server</label><textarea className="input" rows={3} name="instructions" defaultValue={job?.instructions ?? ""} /></div>
      </section>

      <div className="flex justify-end gap-2">
        <button className="btn-primary">{job ? "Save changes" : "Create job"}</button>
      </div>
    </form>
  );
}
