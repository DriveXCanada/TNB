import { prisma } from "./db";
import type { FileKind } from "@prisma/client";

const MAX_BYTES = 25 * 1024 * 1024;

export async function storeUploads(
  files: File[],
  kind: FileKind,
  link: { jobId?: string; attemptId?: string }
) {
  for (const f of files) {
    if (!f || typeof f === "string" || f.size === 0) continue;
    if (f.size > MAX_BYTES) throw new Error(`${f.name} is larger than 25 MB`);
    const buf = Buffer.from(await f.arrayBuffer());
    await prisma.file.create({
      data: {
        kind,
        filename: f.name || "upload",
        mimeType: f.type || "application/octet-stream",
        size: buf.length,
        data: buf,
        ...link,
      },
    });
  }
}
