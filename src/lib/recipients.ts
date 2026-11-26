import { prisma } from "./db";
import { mailEnabled } from "./mail";

export type Recipient = { email: string; label: string; group: "Client" | "Other" | "Server" | "My company" };

/** Everyone an attempt can be emailed to, grouped like the "Email & Share" panel. */
export async function recipientOptions(job: { clientId: string | null; notifyEmails: string | null; serverId: string | null }) {
  const [client, staff] = await Promise.all([
    job.clientId ? prisma.client.findUnique({ where: { id: job.clientId } }) : null,
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const out: Recipient[] = [];
  if (client?.email) out.push({ email: client.email, label: client.contactName || client.name, group: "Client" });
  for (const e of (job.notifyEmails ?? "").split(/[,;\s]+/).filter((x) => x.includes("@")))
    out.push({ email: e, label: e, group: "Client" });
  const server = staff.find((u) => u.id === job.serverId);
  if (server) out.push({ email: server.email, label: server.name, group: "Server" });
  for (const u of staff) if (u.id !== job.serverId) out.push({ email: u.email, label: u.name, group: "My company" });
  const seen = new Set<string>();
  return {
    recipients: out.filter((r) => (seen.has(r.email.toLowerCase()) ? false : (seen.add(r.email.toLowerCase()), true))),
    mailOn: mailEnabled(),
  };
}
