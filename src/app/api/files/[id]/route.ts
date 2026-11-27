import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessJob, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getPortalUser } from "@/lib/portalAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.file.findUnique({
    where: { id },
    include: { job: true, attempt: { include: { job: true } } },
  });
  if (!file) return new Response("Not found", { status: 404 });
  const job = file.job ?? file.attempt?.job;

  let allowed = false;
  const user = await getCurrentUser();
  if (user && job) allowed = canAccessJob(user, job);

  // Client portal: their own job's documents, and photos on attempts shared with them (if photos are enabled).
  if (!allowed && job) {
    const pu = await getPortalUser();
    if (pu && job.clientId === pu.clientId) {
      if (file.kind === "DOCUMENT" && !file.attemptId) allowed = true;
      else if (file.attempt?.shareWithClient) allowed = (await getSettings()).sharePhotosWithClient === "true";
    }
  }

  // Public access via a client tracking link: only shared attempt photos, and only if enabled in settings.
  const token = req.nextUrl.searchParams.get("t");
  if (!allowed && token && file.attempt && job && job.trackingEnabled && job.trackingToken === token && file.attempt.shareWithClient) {
    allowed = (await getSettings()).sharePhotosWithClient === "true";
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const inline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
