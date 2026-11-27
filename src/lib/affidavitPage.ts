import { prisma } from "./db";
import { getSettings } from "./settings";
import { defaultAffidavit, keyAttempt, statementFor } from "./affidavitData";
import { jobPhotos } from "./affidavitPhotos";

/** Job with everything the affidavit pre-fill needs, plus statement defaults for each template. */
export async function affidavitContext(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { client: true, server: true, attempts: { include: { server: true } } },
  });
  if (!job) return null;
  const [settings, photos] = await Promise.all([getSettings(), jobPhotos(jobId)]);
  const defaults = defaultAffidavit(job, settings, "standard", photos.map((p) => p.id));
  const lastServer = keyAttempt(job).deponentUser;
  const name = defaults.deponent || "______________";
  return {
    job,
    defaults,
    photos,
    statements: {
      standard: statementFor("standard", name, lastServer?.city ?? null, settings),
      ns: statementFor("ns", name, lastServer?.city ?? null, settings),
    },
  };
}
