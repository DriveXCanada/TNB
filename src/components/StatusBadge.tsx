import type { JobStatus, Priority } from "@prisma/client";
import { PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "ROUTINE") return null;
  return (
    <span className={`badge ${priority === "SAME_DAY" ? "bg-rose-600 text-white" : "bg-orange-100 text-orange-800"}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
