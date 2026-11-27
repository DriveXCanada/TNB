import type { AttemptOutcome, JobStatus, Priority } from "@prisma/client";

export const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SERVED: "Served",
  NON_SERVICE: "Non-service",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  PENDING: "bg-slate-200 text-slate-800",
  IN_PROGRESS: "bg-gold-500 text-navy-950",
  SERVED: "bg-emerald-600 text-white",
  NON_SERVICE: "bg-rose-600 text-white",
  CANCELLED: "bg-zinc-400 text-white",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  ROUTINE: "Routine",
  RUSH: "Rush",
  SAME_DAY: "Same day",
};

export const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  PERSONAL: "Personal Service",
  UNSUCCESSFUL: "Unsuccessful",
  SUBSTITUTED: "Served – substituted (adult at residence)",
  CORPORATE: "Served – corporation (officer/manager)",
  POSTED: "Served – posted/left at address",
  NOT_HOME: "No answer / not home",
  REFUSED: "Refused to accept",
  BAD_ADDRESS: "Bad Address",
  MOVED: "Recipient moved",
  EVADING: "Recipient evading",
  OTHER: "Other",
};

/** The service types offered when logging an attempt. Older types stay readable on past attempts. */
export const SERVICE_TYPES: { value: AttemptOutcome; label: string }[] = [
  { value: "PERSONAL", label: "Personal Service" },
  { value: "UNSUCCESSFUL", label: "Unsuccessful" },
  { value: "BAD_ADDRESS", label: "Bad Address" },
];

/** What a job's status reads as: "Served", or the number of attempts made so far. */
export function statusText(status: JobStatus, attempts: number) {
  if (status === "SERVED" || status === "NON_SERVICE" || status === "CANCELLED") return STATUS_LABEL[status];
  return attempts === 0 ? "Pending" : `${attempts} Attempt${attempts === 1 ? "" : "s"}`;
}

export const SERVED_OUTCOMES: AttemptOutcome[] = ["PERSONAL", "SUBSTITUTED", "CORPORATE", "POSTED"];

export function isServedOutcome(o: AttemptOutcome) {
  return SERVED_OUTCOMES.includes(o);
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: process.env.APP_TIMEZONE || "America/Halifax",
  });
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-CA", {
    dateStyle: "medium",
    timeZone: process.env.APP_TIMEZONE || "America/Halifax",
  });
}

export function fmtLong(d: Date | string) {
  const tz = process.env.APP_TIMEZONE || "America/Halifax";
  const date = new Date(d).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: tz });
  const time = new Date(d).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return `${date}, at ${time}`;
}

export function jobNo(n: number) {
  return `J-${String(n).padStart(5, "0")}`;
}
