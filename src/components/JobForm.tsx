"use client";

import { useState } from "react";
import Link from "next/link";
import { PRIORITY_LABEL } from "@/lib/labels";
import { NS_COUNTIES, type JobFormValues } from "@/lib/jobForm";

type ClientOpt = { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; address: string | null };
type ServerOpt = { id: string; name: string };

export default function JobForm({
  action,
  job,
  clients,
  servers,
  defaultCourt,
  defaultServerId = "",
  jobNumber,
}: {
  action: (fd: FormData) => Promise<void>;
  job?: JobFormValues;
  clients: ClientOpt[];
  servers: ServerOpt[];
  defaultCourt: string;
  defaultServerId?: string;
  /** Shown read-only; new jobs get the next number on save. */
  jobNumber?: string;
}) {
  const v = (k: string) => job?.[k] ?? "";
  const [clientId, setClientId] = useState(v("clientId"));
  const [plaintiff, setPlaintiff] = useState(v("plaintiff"));
  const [defendant, setDefendant] = useState(v("defendant"));
  const [recipient, setRecipient] = useState(v("recipientName"));
  // Autofill keeps following its source until the user types in the field themselves.
  const [plaintiffTouched, setPlaintiffTouched] = useState(Boolean(job?.plaintiff));
  const [recipientTouched, setRecipientTouched] = useState(Boolean(job?.recipientName));
  const client = clients.find((c) => c.id === clientId);

  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (!plaintiffTouched) setPlaintiff(c?.name ?? "");
  };
  const changeDefendant = (val: string) => {
    setDefendant(val);
    if (!recipientTouched) setRecipient(val);
  };

  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Client</h2>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label">Client</label>
            <Link href="/clients/new" target="_blank" className="text-xs font-semibold text-navy-600">+ New client</Link>
          </div>
          <select className="input" name="clientId" value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">— Select client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job number</label>
          <div className="input bg-slate-50 font-bold text-navy-800">{jobNumber ?? "Assigned automatically when you save"}</div>
        </div>
        {client && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">
            <div className="font-medium">{client.name}</div>
            {client.contactName && <div>{client.contactName}</div>}
            <div className="text-slate-600">
              {[client.email, client.phone].filter(Boolean).join(" · ") || "No email or phone on file"}
            </div>
            {client.address && <div className="whitespace-pre-wrap text-slate-600">{client.address}</div>}
          </div>
        )}
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Court case</h2>
        <div><label className="label">Court case number</label><input className="input" name="courtFileNumber" defaultValue={v("courtFileNumber")} placeholder="Hfx No. 512345" /></div>
        <div>
          <label className="label">Plaintiff</label>
          <input className="input" name="plaintiff" value={plaintiff} onChange={(e) => { setPlaintiff(e.target.value); setPlaintiffTouched(true); }} placeholder="Filled in from the client" />
        </div>
        <div><label className="label">Defendant</label><input className="input" name="defendant" value={defendant} onChange={(e) => changeDefendant(e.target.value)} /></div>
        <div><label className="label">Date filed</label><input className="input" type="date" name="dateFiled" defaultValue={v("dateFiled")} /></div>
        <div><label className="label">Court date</label><input className="input" type="date" name="courtDate" defaultValue={v("courtDate")} /></div>
        <div>
          <label className="label">Court county</label>
          <select className="input" name="courtCounty" defaultValue={v("courtCounty")}>
            <option value="">— Select —</option>
            {v("courtCounty") && !NS_COUNTIES.includes(v("courtCounty")) && <option value={v("courtCounty")}>{v("courtCounty")}</option>}
            {NS_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Documents to be served</label><textarea className="input" rows={2} name="documentsServed" defaultValue={v("documentsServed")} placeholder="Notice of Action and Statement of Claim" /></div>
        <div className="sm:col-span-2"><label className="label">Upload documents (PDF, images)</label><input className="input" type="file" name="documents" multiple /></div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Party to serve</h2>
        <div>
          <label className="label">Name *</label>
          <input className="input" name="recipientName" required value={recipient} onChange={(e) => { setRecipient(e.target.value); setRecipientTouched(true); }} placeholder="Filled in from the defendant" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="recipientType" defaultValue={v("recipientType") || "INDIVIDUAL"}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="CORPORATION">Corporation / business</option>
            <option value="GOVERNMENT">Government / agency</option>
          </select>
        </div>
        <div><label className="label">Email</label><input className="input" type="email" name="recipientEmail" defaultValue={v("recipientEmail")} /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" name="recipientPhone" defaultValue={v("recipientPhone")} /></div>
        <div className="sm:col-span-2"><label className="label">Service address *</label><input className="input" name="address" required defaultValue={v("address")} placeholder="1234 Barrington St, Halifax, NS B3J 1Y9" /></div>
        <div className="sm:col-span-2"><label className="label">Alternate addresses (one per line)</label><textarea className="input" rows={2} name="altAddresses" defaultValue={v("altAddresses")} /></div>
        <div className="sm:col-span-2"><label className="label">Description (age, appearance, vehicle…)</label><textarea className="input" rows={2} name="recipientDescription" defaultValue={v("recipientDescription")} /></div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Assignment</h2>
        <div>
          <label className="label">Process server</label>
          <select className="input" name="serverId" defaultValue={job ? v("serverId") : defaultServerId}>
            <option value="">— Unassigned —</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="label">Attempt due date</label><input className="input" type="date" name="dueDate" defaultValue={v("dueDate")} /></div>
        <div>
          <label className="label">Priority</label>
          <select className="input" name="priority" defaultValue={v("priority") || "ROUTINE"}>
            {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div><label className="label">Fee (reference)</label><input className="input" type="number" step="0.01" min="0" name="fee" defaultValue={v("fee")} /></div>
        <div className="sm:col-span-2"><label className="label">Instructions for server</label><textarea className="input" rows={3} name="instructions" defaultValue={v("instructions")} /></div>
      </section>

      <div className="flex justify-end gap-2">
        <button className="btn-accent px-8 py-3 text-base">{job ? "Save changes" : "Create job"}</button>
      </div>
    </form>
  );
}
