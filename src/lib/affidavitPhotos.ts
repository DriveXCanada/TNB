import { prisma } from "./db";
import { fmtDateTime, OUTCOME_LABEL } from "./labels";

/** Formats pdf-lib can embed. Phone photos are converted to JPEG on upload, so this covers them. */
const EMBEDDABLE = ["image/jpeg", "image/jpg", "image/png"];

/** Every attempt photo on a job that can go into an affidavit, oldest attempt first. */
export async function jobPhotos(jobId: string) {
  const files = await prisma.file.findMany({
    where: { jobId, kind: "PHOTO", attemptId: { not: null }, mimeType: { in: EMBEDDABLE } },
    select: { id: true, attempt: { select: { outcome: true, attemptedAt: true, address: true } } },
  });
  return files
    .filter((f) => f.attempt)
    .sort((a, b) => +a.attempt!.attemptedAt - +b.attempt!.attemptedAt)
    .map((f) => ({
      id: f.id,
      caption: `${OUTCOME_LABEL[f.attempt!.outcome]} · ${fmtDateTime(f.attempt!.attemptedAt)} · ${f.attempt!.address}`,
    }));
}

/** Load the chosen photos for rendering, only ones that belong to this job. */
export async function loadPhotos(jobId: string, ids: string[]) {
  if (!ids.length) return [];
  const captions = new Map((await jobPhotos(jobId)).map((p) => [p.id, p.caption]));
  const files = await prisma.file.findMany({ where: { id: { in: ids.filter((id) => captions.has(id)) }, jobId }, select: { id: true, data: true, mimeType: true } });
  const byId = new Map(files.map((f) => [f.id, f]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => ({ data: Buffer.from(byId.get(id)!.data), mimeType: byId.get(id)!.mimeType, caption: captions.get(id)! }));
}
