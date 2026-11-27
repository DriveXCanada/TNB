import type { Job } from "@prisma/client";

export const NS_COUNTIES = [
  "Annapolis", "Antigonish", "Cape Breton", "Colchester", "Cumberland", "Digby", "Guysborough", "Halifax", "Hants",
  "Inverness", "Kentville", "Kings", "Lunenburg", "Pictou", "Queens", "Richmond", "Shelburne", "Victoria", "Yarmouth",
];

export type JobFormValues = Record<string, string>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Plain, serializable values for the client-side job form. */
export function jobToFormValues(job: Job): JobFormValues {
  return {
    clientId: job.clientId ?? "",
    clientReference: job.clientReference ?? "",
    notifyEmails: job.notifyEmails ?? "",
    courtFileNumber: job.courtFileNumber ?? "",
    courtName: job.courtName ?? "",
    courtCounty: job.courtCounty ?? "",
    plaintiff: job.plaintiff ?? "",
    defendant: job.defendant ?? "",
    dateFiled: day(job.dateFiled),
    courtDate: day(job.courtDate),
    documentsServed: job.documentsServed ?? "",
    recipientName: job.recipientName,
    recipientType: job.recipientType,
    recipientEmail: job.recipientEmail ?? "",
    recipientPhone: job.recipientPhone ?? "",
    recipientDescription: job.recipientDescription ?? "",
    address: job.address,
    altAddresses: job.altAddresses ?? "",
    serverId: job.serverId ?? "",
    dueDate: day(job.dueDate),
    priority: job.priority,
    fee: job.fee?.toString() ?? "",
    instructions: job.instructions ?? "",
  };
}

/** "Jane Doe, Plaintiff, and John Smith, Defendant" style title, falling back to the legacy free-text title. */
export function styleOfCause(job: Pick<Job, "plaintiff" | "defendant" | "caseTitle">) {
  if (job.plaintiff || job.defendant)
    return `${job.plaintiff || "______"}, Plaintiff, and ${job.defendant || "______"}, Defendant`;
  return job.caseTitle ?? "";
}
