import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Attempt, Job, User, Client } from "@prisma/client";
import type { Settings } from "./settings";
import { fmtDateTime, isServedOutcome, OUTCOME_LABEL } from "./labels";

type JobFull = Job & { attempts: (Attempt & { server: User | null })[]; client: Client | null; server: User | null };

function serviceSentence(job: JobFull, a: Attempt) {
  const when = fmtDateTime(a.attemptedAt);
  const docs = job.documentsServed?.trim() || "the documents in this proceeding";
  const who = job.recipientName;
  switch (a.outcome) {
    case "PERSONAL":
      return `On ${when}, I served ${who} with ${docs} by leaving a copy with ${a.personServed || who} personally at ${a.address}.`;
    case "SUBSTITUTED":
      return `On ${when}, I served ${who} with ${docs} by leaving a copy, in a sealed envelope addressed to ${who}, with ${a.personServed || "a person"}${a.relationship ? ` (${a.relationship})` : ""}, who appeared to be an adult member of the same household, at ${a.address}, being the residence of ${who}.`;
    case "CORPORATE":
      return `On ${when}, I served ${who} with ${docs} by leaving a copy with ${a.personServed || "a person"}${a.relationship ? `, ${a.relationship}` : ""}, who appeared to be in control or management of the place of business of ${who}, at ${a.address}.`;
    case "POSTED":
      return `On ${when}, I served ${who} with ${docs} by leaving a copy at ${a.address}.`;
    default:
      return `On ${when}, I attended at ${a.address}: ${OUTCOME_LABEL[a.outcome]}.`;
  }
}

class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage([612, 792]);
    this.y = 740;
  }
  ensure(h: number) {
    if (this.y - h < 60) {
      this.page = this.doc.addPage([612, 792]);
      this.y = 740;
    }
  }
  text(str: string, opts: { size?: number; bold?: boolean; center?: boolean; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.font;
    const left = 72 + (opts.indent ?? 0);
    const width = 612 - 72 - left;
    for (const para of str.split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      const lines: string[] = [];
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      lines.push(line);
      for (const l of lines) {
        this.ensure(size + 4);
        const x = opts.center ? (612 - font.widthOfTextAtSize(l, size)) / 2 : left;
        this.page.drawText(l, { x, y: this.y, size, font, color: rgb(0, 0, 0) });
        this.y -= size + 4;
      }
    }
    this.y -= opts.gap ?? 6;
  }
  rule(x1: number, x2: number) {
    this.page.drawLine({ start: { x: x1, y: this.y }, end: { x: x2, y: this.y }, thickness: 0.7 });
  }
}

export async function buildAffidavit(job: JobFull, settings: Settings, attemptId?: string) {
  const served = attemptId
    ? job.attempts.find((a) => a.id === attemptId)
    : [...job.attempts].reverse().find((a) => isServedOutcome(a.outcome)) ?? job.attempts.at(-1);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const w = new Writer(doc, font, bold);

  const server = served?.server ?? job.server;
  const serverName = server?.name ?? "______________________";
  const serverCity = server?.city || "______________";
  const province = settings.province || "______________";

  if (job.courtFileNumber) w.text(`Court File No. ${job.courtFileNumber}`, { size: 11, gap: 14 });
  w.text((job.courtName || settings.defaultCourt || "").toUpperCase(), { bold: true, center: true, size: 13, gap: 12 });
  if (job.caseTitle) w.text(job.caseTitle, { center: true, gap: 18 });
  w.text("AFFIDAVIT OF SERVICE", { bold: true, center: true, size: 14, gap: 18 });

  w.text(
    `I, ${serverName}, of the City of ${serverCity}, in the Province of ${province}, ${settings.oathPhrase}:`,
    { gap: 12 }
  );

  let n = 1;
  if (served) {
    w.text(`${n++}. ${serviceSentence(job, served)}`, { indent: 0, gap: 10 });
    if (served.outcome === "PERSONAL" || served.outcome === "CORPORATE" || served.outcome === "SUBSTITUTED") {
      if (served.personDescription)
        w.text(`${n++}. The person served is described as follows: ${served.personDescription}.`, { gap: 10 });
    }
    if (served.outcome === "SUBSTITUTED") {
      w.text(
        `${n++}. On ______________________, I mailed another copy of the documents to ${job.recipientName} at ${served.address}.`,
        { gap: 10 }
      );
    }
  } else {
    w.text(`${n++}. No service attempt has been recorded for this job.`, { gap: 10 });
  }

  const prior = job.attempts.filter((a) => a.id !== served?.id && !isServedOutcome(a.outcome));
  if (prior.length) {
    w.text(`${n++}. Prior to service, I or an agent of ${settings.companyName} attempted service as follows:`, { gap: 4 });
    for (const a of prior) w.text(`• ${fmtDateTime(a.attemptedAt)} at ${a.address}: ${OUTCOME_LABEL[a.outcome]}${a.notes ? ` – ${a.notes}` : ""}`, { indent: 18, gap: 2 });
    w.text("", { gap: 6 });
  }

  w.text(`${n++}. I am not a party to this proceeding and I am over the age of eighteen years.`, { gap: 30 });

  w.ensure(140);
  const top = w.y;
  w.page.drawText("SWORN (or AFFIRMED) BEFORE ME", { x: 72, y: top, size: 10, font: bold });
  w.page.drawText(`at the ____________ of ____________,`, { x: 72, y: top - 14, size: 10, font });
  w.page.drawText(`in the Province of ${province},`, { x: 72, y: top - 28, size: 10, font });
  w.page.drawText(`on ______________________.`, { x: 72, y: top - 42, size: 10, font });
  w.y = top - 90;
  w.rule(72, 280);
  w.rule(330, 540);
  w.y -= 12;
  w.page.drawText(settings.commissionerTitle, { x: 72, y: w.y, size: 9, font, maxWidth: 220 });
  w.page.drawText(serverName, { x: 330, y: w.y, size: 9, font });
  w.y -= 40;

  if (settings.affidavitFooter) w.text(settings.affidavitFooter, { size: 9 });

  return doc.save();
}
