import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, canAccessJob, requirePerm } from "@/lib/auth";
import { saveAffidavitAction } from "@/app/actions";
import { affidavitContext } from "@/lib/affidavitPage";
import { sanitizeAffidavit } from "@/lib/affidavitData";
import AffidavitHeader from "@/components/AffidavitHeader";
import AffidavitEditor from "@/components/AffidavitEditor";

export default async function EditAffidavitPage({ params }: { params: Promise<{ id: string; afid: string }> }) {
  const user = await requirePerm("createAffidavits");
  const { id, afid } = await params;
  const [ctx, a] = await Promise.all([affidavitContext(id), prisma.affidavit.findUnique({ where: { id: afid }, select: { jobId: true, data: true } })]);
  if (!ctx || !a || a.jobId !== id || !canAccessJob(user, ctx.job)) notFound();
  return (
    <div>
      <AffidavitHeader job={ctx.job} />
      <AffidavitEditor initial={sanitizeAffidavit(a.data, ctx.defaults)} statements={ctx.statements} action={saveAffidavitAction.bind(null, id, afid)} canShare={can(user, "emailSharing")} cancelHref={`/jobs/${id}/affidavits/${afid}`} />
    </div>
  );
}
