import type { Job, User } from "@prisma/client";
import { prisma } from "./db";
import { can } from "./auth";

/** Shared data for the new/edit attempt pages. */
export async function attemptPageData(user: User, job: Job) {
  const staff = can(user, "manageJobs");
  const [servers, client, attempts] = await Promise.all([
    staff ? prisma.user.findMany({ where: { active: true, role: { not: "CONTACT" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [{ id: user.id, name: user.name }],
    job.clientId ? prisma.client.findUnique({ where: { id: job.clientId } }) : null,
    prisma.attempt.count({ where: { jobId: job.id } }),
  ]);
  return { servers, canChooseServer: staff, jobWithClient: { ...job, client }, attempts };
}
