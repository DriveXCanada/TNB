import type { AttemptOutcome, JobStatus, Priority } from "@prisma/client";

export const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SERVED: "Served",
  NON_SERVICE: "Non-service",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  SERVED: "bg-emerald-100 text-emerald-800",
  NON_SERVICE: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-zinc-200 text-zinc-600",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  ROUTINE: "Routine",
  RUSH: "Rush",
  SAME_DAY: "Same day",
};

export const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  PERSONAL: "Served – personal service",
  SUBSTITUTED: "Served – substituted (adult at residence)",
  CORPORATE: "Served – corporation (officer/manager)",
  POSTED: "Served – posted/left at address",
  NOT_HOME: "No answer / not home",
  REFUSED: "Refused to accept",
  BAD_ADDRESS: "Bad address",
  MOVED: "Recipient moved",
  EVADING: "Recipient evading",
  OTHER: "Other",
};

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
