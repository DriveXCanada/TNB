import type { Job, User } from "@prisma/client";
import { prisma } from "./db";
import { isStaff } from "./auth";
import { recipientOptions } from "./recipients";

/** Shared data for the new/edit attempt pages. */
export async function attemptPageData(user: User, job: Job) {
  const staff = isStaff(user);
  const [{ recipients, mailOn }, servers, client, attempts] = await Promise.all([
    recipientOptions(job),
    staff ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [{ id: user.id, name: user.name }],
    job.clientId ? prisma.client.findUnique({ where: { id: job.clientId } }) : null,
    prisma.attempt.count({ where: { jobId: job.id } }),
  ]);
  return { recipients, mailOn, servers, canChooseServer: staff, jobWithClient: { ...job, client }, attempts };
}
