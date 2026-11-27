import { notFound } from "next/navigation";
import { canAccessJob, requirePerm } from "@/lib/auth";
import { saveAffidavitAction } from "@/app/actions";
import { affidavitContext } from "@/lib/affidavitPage";
import AffidavitHeader from "@/components/AffidavitHeader";
import AffidavitEditor from "@/components/AffidavitEditor";

export default async function NewAffidavitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("createAffidavits");
  const { id } = await params;
  const ctx = await affidavitContext(id);
  if (!ctx || !canAccessJob(user, ctx.job)) notFound();
  return (
    <div>
      <AffidavitHeader job={ctx.job} />
      <AffidavitEditor initial={ctx.defaults} statements={ctx.statements} action={saveAffidavitAction.bind(null, id, null)} cancelHref={`/jobs/${id}`} />
    </div>
  );
}
