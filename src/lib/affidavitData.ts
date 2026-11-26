import type { Attempt, Client, Job, User } from "@prisma/client";
import type { Settings } from "./settings";
import { fmtDateTime, isServedOutcome, jobNo, OUTCOME_LABEL } from "./labels";

export type AffidavitTemplate = "standard" | "ns";
export type AffidavitKind = "SERVICE" | "NON_SERVICE";

/** Every editable field on an affidavit. Saved as JSON and rendered to PDF. */
export type AffidavitData = {
  template: AffidavitTemplate;
  kind: AffidavitKind;
  caseNo: string;
  court: string;
  county: string;
  jobRef: string;
  plaintiff: string;
  defendant: string;
  receivedBy: string;
  forClient: string;
  servedUpon: string;
  deponent: string;
  statement: string;
  recipientAddress: string;
  manner: string;
  documents: string;
  comments: string;
  includeFees: boolean;
  fees: string;
  showNotary: boolean;
  notaryText: string;
  province: string;
  commissionerTitle: string;
  footer: string;
};

export const AFFIDAVIT_TEMPLATES: { value: AffidavitTemplate; label: string }[] = [
  { value: "standard", label: "Standard Affidavit" },
  { value: "ns", label: "Nova Scotia (Form 31.05 style)" },
];

export function affidavitTitle(d: Pick<AffidavitData, "kind">) {
  return d.kind === "SERVICE" ? "AFFIDAVIT OF SERVICE" : "AFFIDAVIT OF NON-SERVICE";
}

type JobFull = Job & { client: Client | null; server: User | null; attempts: (Attempt & { server: User | null })[] };

export function statementFor(template: AffidavitTemplate, name: string, city: string | null, settings: Settings) {
  if (template === "ns")
    return `I, ${name}, of ${city || "______________"}, ${settings.province || "Nova Scotia"}, ${settings.oathPhrase}: I am not a party to this proceeding.`;
  return settings.affidavitStatement.replace(/\{name\}/g, name);
}

/** The attempt an affidavit is about: the service if there was one, otherwise the latest attempt. */
export function keyAttempt(job: JobFull) {
  const attempts = [...job.attempts].sort((a, b) => +a.attemptedAt - +b.attemptedAt);
  const served = [...attempts].reverse().find((a) => isServedOutcome(a.outcome));
  const last = served ?? attempts.at(-1);
  return { attempts, served, last, deponentUser: last?.server ?? job.server };
}

/** Pre-fill an affidavit from the job, its attempts and the company settings. */
export function defaultAffidavit(job: JobFull, settings: Settings, template: AffidavitTemplate = "standard"): AffidavitData {
  const { attempts, served, last, deponentUser } = keyAttempt(job);
  const name = deponentUser?.name ?? "";

  let manner = last ? OUTCOME_LABEL[last.outcome] : "";
  if (served) {
    manner = `${OUTCOME_LABEL[served.outcome]}: delivered to ${served.personServed || job.recipientName} on ${fmtDateTime(served.attemptedAt)} at ${served.address}`;
  }

  const comments = attempts
    .map((a, i) => {
      const head = `${i + 1}) ${isServedOutcome(a.outcome) ? "Successful Attempt" : `${OUTCOME_LABEL[a.outcome]} Attempt`}: ${fmtDateTime(a.attemptedAt)} at ${a.address}`;
      const extra = [
        a.personServed && `Served: ${a.personServed}${a.relationship ? ` (${a.relationship})` : ""}`,
        a.personDescription && `Description: ${a.personDescription}`,
        a.identifiedBy && `Identified: ${a.identifiedBy}`,
        a.notes,
      ].filter(Boolean);
      return [head, ...extra].join("\n");
    })
    .join("\n");

  return {
    template,
    kind: served ? "SERVICE" : "NON_SERVICE",
    caseNo: job.courtFileNumber ?? "",
    court: job.courtName ?? settings.defaultCourt,
    county: job.courtCounty ?? "",
    jobRef: `${jobNo(job.number)}${job.clientReference ? ` (${job.clientReference})` : ""}`,
    plaintiff: job.plaintiff ?? "",
    defendant: job.defendant ?? "",
    receivedBy: settings.companyName,
    forClient: job.client?.name ?? "",
    servedUpon: job.recipientName,
    deponent: name,
    statement: statementFor(template, name || "______________", deponentUser?.city ?? null, settings),
    recipientAddress: `${job.recipientName}, ${last?.address ?? job.address}`,
    manner,
    documents: job.documentsServed ?? "",
    comments,
    includeFees: false,
    fees: job.fee ? `Service fee: $${job.fee.toFixed(2)}` : "",
    showNotary: true,
    notaryText: settings.notaryText,
    province: settings.province,
    commissionerTitle: settings.commissionerTitle,
    footer: settings.affidavitFooter,
  };
}

/** Accept only known keys with the right types from a submitted form. */
export function sanitizeAffidavit(raw: unknown, fallback: AffidavitData): AffidavitData {
  const out = { ...fallback };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(fallback) as (keyof AffidavitData)[]) {
    const v = r[k];
    if (typeof fallback[k] === "boolean" && typeof v === "boolean") (out as Record<string, unknown>)[k] = v;
    else if (typeof fallback[k] === "string" && typeof v === "string") (out as Record<string, unknown>)[k] = v.slice(0, 20000);
  }
  if (out.template !== "standard" && out.template !== "ns") out.template = "standard";
  if (out.kind !== "SERVICE" && out.kind !== "NON_SERVICE") out.kind = "NON_SERVICE";
  return out;
}
