import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { buildAffidavit } from "@/lib/affidavit";
import { jobNo } from "@/lib/labels";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { client: true, server: true, attempts: { orderBy: { attemptedAt: "asc" }, include: { server: true } } },
  });
  if (!job) return new Response("Not found", { status: 404 });
  const pdf = await buildAffidavit(job, await getSettings(), req.nextUrl.searchParams.get("attempt") ?? undefined);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Affidavit-of-Service-${jobNo(job.number)}.pdf"`,
    },
  });
}
