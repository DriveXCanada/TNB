import { prisma } from "./db";
import { getSettings } from "./settings";
import { OUTCOME_LABEL, STATUS_LABEL, isServedOutcome, jobNo } from "./labels";

export type TrackingData = Awaited<ReturnType<typeof getTrackingData>>;

/** Client-safe view of a job: no internal notes, instructions, fees or unshared attempts. */
export async function getTrackingData(token: string) {
  const job = await prisma.job.findUnique({
    where: { trackingToken: token },
    include: {
      client: true,
      attempts: {
        where: { shareWithClient: true },
        orderBy: { attemptedAt: "desc" },
        include: { server: true, files: { where: { kind: "PHOTO" }, select: { id: true } } },
      },
    },
  });
  if (!job || !job.trackingEnabled) return null;
  const settings = await getSettings();
  const photos = settings.sharePhotosWithClient === "true";
  return {
    company: { name: settings.companyName, phone: settings.companyPhone, email: settings.companyEmail },
    job: {
      number: jobNo(job.number),
      recipientName: job.recipientName,
      address: job.address,
      status: job.status,
      statusLabel: STATUS_LABEL[job.status],
      clientName: job.client?.name ?? null,
      clientReference: job.clientReference,
      courtFileNumber: job.courtFileNumber,
      documentsServed: job.documentsServed,
      dueDate: job.dueDate?.toISOString() ?? null,
      servedAt: job.servedAt?.toISOString() ?? null,
    },
    attempts: job.attempts.map((a) => ({
      id: a.id,
      attemptedAt: a.attemptedAt.toISOString(),
      outcome: OUTCOME_LABEL[a.outcome],
      served: isServedOutcome(a.outcome),
      address: a.address,
      notes: a.notes,
      personServed: a.personServed,
      relationship: a.relationship,
      serverName: a.server?.name ?? null,
      gps: a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null,
      photoUrls: photos ? a.files.map((f) => `/api/files/${f.id}?t=${token}`) : [],
    })),
    updatedAt: new Date().toISOString(),
  };
}
