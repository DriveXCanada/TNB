import type { JobStatus, Priority } from "@prisma/client";
import { PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL, statusText } from "@/lib/labels";

/** Pass `attempts` to show "N Attempts" for jobs that are not yet served. */
export function StatusBadge({ status, attempts }: { status: JobStatus; attempts?: number }) {
  return <span className={`badge ${STATUS_COLOR[status]}`}>{attempts === undefined ? STATUS_LABEL[status] : statusText(status, attempts)}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "ROUTINE") return null;
  return (
    <span className={`badge ${priority === "SAME_DAY" ? "bg-rose-600 text-white" : "bg-orange-100 text-orange-800"}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
