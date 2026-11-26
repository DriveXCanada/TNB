import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createJobAction } from "@/app/actions";
import JobForm from "@/components/JobForm";

export default async function NewJobPage() {
  await requirePerm("manageJobs");
  const [clients, servers, settings] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, contactName: true, email: true, phone: true, address: true } }),
    prisma.user.findMany({ where: { active: true, role: { not: "CONTACT" } }, orderBy: { name: "asc" }, select: { id: true, name: true, defaultServer: true } }),
    getSettings(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">New job</h1>
      <JobForm action={createJobAction} clients={clients} servers={servers} defaultCourt={settings.defaultCourt} defaultServerId={servers.find((s) => s.defaultServer)?.id} />
    </div>
  );
}
