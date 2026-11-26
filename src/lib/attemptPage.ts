import type { Job, User } from "@prisma/client";
import { prisma } from "./db";
import { can } from "./auth";
import { recipientOptions } from "./recipients";

/** Shared data for the new/edit attempt pages. */
export async function attemptPageData(user: User, job: Job) {
  const staff = can(user, "manageJobs");
  const [{ recipients, mailOn }, servers, client, attempts] = await Promise.all([
    recipientOptions(job),
    staff ? prisma.user.findMany({ where: { active: true, role: { not: "CONTACT" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [{ id: user.id, name: user.name }],
    job.clientId ? prisma.client.findUnique({ where: { id: job.clientId } }) : null,
    prisma.attempt.count({ where: { jobId: job.id } }),
  ]);
  return { recipients, mailOn, servers, canChooseServer: staff, canEmail: can(user, "emailSharing"), jobWithClient: { ...job, client }, attempts };
}
