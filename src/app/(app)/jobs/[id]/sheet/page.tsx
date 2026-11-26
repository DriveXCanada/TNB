import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessJob, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { jobAddresses } from "@/lib/jobAddresses";
import { fmtDate, fmtDateTime, jobNo, OUTCOME_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import PrintButton from "@/components/PrintButton";

export default async function FieldSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { client: true, server: true, attempts: { orderBy: { attemptedAt: "asc" }, include: { server: true } } },
  });
  if (!job || !canAccessJob(user, job)) notFound();
  const settings = await getSettings();
  const r = (k: string, v: React.ReactNode) => (v ? <tr><td className="w-40 py-1 pr-3 align-top text-slate-500">{k}</td><td className="py-1 whitespace-pre-wrap">{v}</td></tr> : null);
  return (
    <div className="mx-auto max-w-3xl space-y-4 bg-white p-6 text-sm print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">{settings.companyName} – Field Sheet</div>
          <div>{jobNo(job.number)}{job.courtFileNumber && ` · ${job.courtFileNumber}`} · {PRIORITY_LABEL[job.priority]}</div>
        </div>
        <PrintButton />
      </div>
      <table className="w-full">
        <tbody>
          {r("Party to serve", <b>{job.recipientName}</b>)}
          {r("Service address", jobAddresses(job).join("\n"))}
          {r("Phone", job.recipientPhone)}
          {r("Email", job.recipientEmail)}
          {r("Description", job.recipientDescription)}
          {r("Documents", job.documentsServed)}
          {r("Instructions", job.instructions)}
          {r("Plaintiff", job.plaintiff)}
          {r("Defendant", job.defendant)}
          {r("Court", [job.courtName, job.courtCounty && `${job.courtCounty} County`].filter(Boolean).join(", "))}
          {r("Court date", fmtDate(job.courtDate))}
          {r("Attempt due", fmtDate(job.dueDate))}
          {r("Client", job.client && `${job.client.name}${job.clientReference ? ` (job no. ${job.clientReference})` : ""}`)}
          {r("Server", job.server?.name)}
        </tbody>
      </table>
      <div>
        <div className="mb-1 font-semibold">Attempts</div>
        <table className="w-full border-collapse">
          <thead><tr className="border-b text-left"><th className="py-1">Date / time</th><th>Address</th><th>Result / notes</th></tr></thead>
          <tbody>
            {job.attempts.map((a) => (
              <tr key={a.id} className="border-b align-top"><td className="py-1 pr-2">{fmtDateTime(a.attemptedAt)}</td><td className="pr-2">{a.address}</td><td>{OUTCOME_LABEL[a.outcome]}{a.notes && ` – ${a.notes}`}</td></tr>
            ))}
            {Array.from({ length: Math.max(3, 6 - job.attempts.length) }).map((_, i) => (
              <tr key={`blank${i}`} className="h-10 border-b"><td /><td /><td /></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
