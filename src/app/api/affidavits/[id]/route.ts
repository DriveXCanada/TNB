import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessJob, getCurrentUser } from "@/lib/auth";
import { jobNo } from "@/lib/labels";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const a = await prisma.affidavit.findUnique({ where: { id }, include: { job: true } });
  if (!a || !canAccessJob(user, a.job)) return new Response("Not found", { status: 404 });
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
