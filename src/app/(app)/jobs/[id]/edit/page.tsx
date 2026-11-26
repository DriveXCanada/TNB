import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateJobAction } from "@/app/actions";
import { jobNo } from "@/lib/labels";
import JobForm from "@/components/JobForm";
import { jobToFormValues } from "@/lib/jobForm";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [job, clients, servers] = await Promise.all([
    prisma.job.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, contactName: true, email: true, phone: true, address: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!job) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">Edit {jobNo(job.number)}</h1>
      <JobForm action={updateJobAction.bind(null, id)} job={jobToFormValues(job)} clients={clients} servers={servers} defaultCourt="" />
    </div>
  );
}
