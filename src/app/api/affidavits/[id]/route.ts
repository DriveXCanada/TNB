import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessJob, getCurrentUser } from "@/lib/auth";
import { jobNo } from "@/lib/labels";
import { getPortalUser } from "@/lib/portalAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.affidavit.findUnique({ where: { id }, include: { job: true } });
  if (!a) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  const staffOk = user && canAccessJob(user, a.job);
  // Client portal users: only affidavits marked visible, on their own company's jobs.
  const pu = staffOk ? null : await getPortalUser();
  const portalOk = pu && a.clientVisible && a.job.clientId === pu.clientId;
  if (!staffOk && !portalOk) return new Response("Not found", { status: 404 });
  const name = `${a.kind === "SERVICE" ? "Affidavit-of-Service" : "Affidavit-of-Non-Service"}-${jobNo(a.job.number)}.pdf`;
  const download = req.nextUrl.searchParams.has("download");
  return new Response(new Uint8Array(a.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
