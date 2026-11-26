import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { affidavitTitle, type AffidavitData } from "./affidavitData";

const W = 612, H = 792, M = 54;
const GREY = rgb(0.88, 0.9, 0.93);

/** pdf-lib's standard fonts only cover WinAnsi; swap characters it can't draw. */
function clean(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x0A\x20-\x7E\xA0-\xFF–—•…€]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of clean(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

class Doc {
  page!: PDFPage;
  y = 0;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public italic: PDFFont) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }
  ensure(h: number) {
    if (this.y - h < M) this.newPage();
  }
  para(text: string, o: { x?: number; width?: number; size?: number; font?: PDFFont; gap?: number; center?: boolean; right?: boolean } = {}) {
    const size = o.size ?? 10, font = o.font ?? this.font, x = o.x ?? M, width = o.width ?? W - M - x;
    for (const l of wrap(text, font, size, width)) {
      this.ensure(size + 3);
      const tw = font.widthOfTextAtSize(l, size);
      this.page.drawText(l, { x: o.center ? x + (width - tw) / 2 : o.right ? x + width - tw : x, y: this.y - size, size, font, color: rgb(0, 0, 0) });
      this.y -= size + 3;
    }
    this.y -= o.gap ?? 6;
  }
  line(x1: number, x2: number, y: number) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color: rgb(0, 0, 0) });
  }
}

/** Grid of labelled cells, like a court-form header table. */
function table(d: Doc, rows: { label: string; value: string }[][]) {
  const width = W - 2 * M;
  for (const row of rows) {
    const cw = width / row.length;
    const heights = row.map((c) => 14 + wrap(c.value || " ", d.font, 10, cw - 10).length * 13 + 4);
    const h = Math.max(...heights);
    d.ensure(h);
    row.forEach((c, i) => {
      const x = M + i * cw;
      d.page.drawRectangle({ x, y: d.y - h, width: cw, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.7 });
      d.page.drawText(clean(c.label), { x: x + 5, y: d.y - 11, size: 8.5, font: d.bold });
      wrap(c.value || " ", d.font, 10, cw - 10).forEach((l, j) => d.page.drawText(l, { x: x + 5, y: d.y - 24 - j * 13, size: 10, font: d.font }));
    });
    d.y -= h;
  }
  d.y -= 12;
}

function labelled(d: Doc, label: string, value: string) {
  const lw = 135;
  const lines = wrap(value || " ", d.font, 10, W - 2 * M - lw);
  d.ensure(lines.length * 13);
  d.page.drawText(clean(label), { x: M, y: d.y - 10, size: 10, font: d.bold });
  lines.forEach((l, i) => d.page.drawText(l, { x: M + lw, y: d.y - 10 - i * 13, size: 10, font: d.font }));
  d.y -= lines.length * 13 + 4;
}

function standard(d: Doc, a: AffidavitData) {
  d.page.drawRectangle({ x: M, y: d.y - 22, width: W - 2 * M, height: 22, color: GREY });
  d.para(affidavitTitle(a), { size: 13, font: d.bold, center: true, x: M, width: W - 2 * M, gap: 4 });
  d.y -= 8;
  table(d, [
    [{ label: "Case:", value: a.caseNo }, { label: "Court:", value: a.court }, { label: "County:", value: a.county }, { label: "Job:", value: a.jobRef }],
    [{ label: "Plaintiff / Petitioner:", value: a.plaintiff }, { label: "Defendant / Respondent:", value: a.defendant }],
    [{ label: "Received by:", value: a.receivedBy }, { label: "For:", value: a.forClient }],
    [{ label: "To be served upon:", value: a.servedUpon }],
  ]);
  d.para(a.statement, { gap: 12 });
  labelled(d, "Recipient Name / Address:", a.recipientAddress);
  labelled(d, "Manner of Service:", a.manner);
  labelled(d, "Documents:", a.documents);
  d.y -= 8;
  if (a.comments.trim()) {
    d.para("Additional Comments:", { font: d.bold, gap: 2 });
    d.para(a.comments, { gap: 10 });
  }
  if (a.includeFees && a.fees.trim()) d.para(a.fees, { gap: 10 });

  d.ensure(150);
  const top = d.y - 40;
  d.line(M, M + 170, top);
  d.line(M + 185, M + 255, top);
  d.page.drawText(clean(a.deponent), { x: M, y: top - 12, size: 10, font: d.font });
  d.page.drawText("Date", { x: M + 185, y: top - 12, size: 10, font: d.bold });
  if (a.showNotary) {
    const x = 330;
    wrap(a.notaryText, d.italic, 8.5, W - M - x).forEach((l, i) => d.page.drawText(l, { x, y: top + 22 - i * 11, size: 8.5, font: d.italic }));
    d.line(x, W - M, top - 20);
    d.page.drawText("Commissioner of Oaths", { x, y: top - 32, size: 10, font: d.bold });
    d.line(x, W - M, top - 62);
    d.page.drawText("Date", { x, y: top - 74, size: 10, font: d.bold });
  }
  d.y = top - 95;
  if (a.footer) d.para(a.footer, { size: 8.5 });
}

function novaScotia(d: Doc, a: AffidavitData) {
  const blank = "____________________";
  d.para(a.caseNo || "20__ Hfx No. __________", { right: true, gap: 16 });
  d.para(a.court || "Supreme Court of Nova Scotia", { font: d.bold, size: 13, center: true, gap: 12 });
  d.para("Between:", { gap: 6 });
  d.para(a.plaintiff || blank, { font: d.bold, center: true, gap: 0 });
  d.para("Plaintiff", { right: true, gap: 4 });
  d.para("and", { center: true, gap: 4 });
  d.para(a.defendant || blank, { font: d.bold, center: true, gap: 0 });
  d.para("Defendant", { right: true, gap: 16 });
  d.para(affidavitTitle(a).replace(/\b(\w)(\w*)/g, (_, f: string, r: string) => f + r.toLowerCase()).replace("Non-service", "Non-Service"), { font: d.bold, size: 14, center: true, gap: 14 });
  d.para(a.statement, { gap: 10 });
  labelled(d, "Recipient / Address:", a.recipientAddress);
  labelled(d, "Manner of Service:", a.manner);
  labelled(d, "Documents:", a.documents);
  if (a.kind === "SERVICE") labelled(d, "Exhibit:", `Exhibit "A" to this affidavit is a true copy of the documents delivered.`);
  d.y -= 6;
  if (a.comments.trim()) {
    d.para("Attempts:", { font: d.bold, gap: 2 });
    d.para(a.comments, { gap: 10 });
  }
  if (a.includeFees && a.fees.trim()) d.para(a.fees, { gap: 10 });
  d.ensure(170);
  const top = d.y - 10;
  const t = (x: number, y: number, s: string, size = 10, f = d.font) => d.page.drawText(clean(s), { x, y, size, font: f });
  t(M, top, "Sworn to [or Affirmed] at ________________,");
  t(M, top - 14, `${a.province || "Nova Scotia"}, on ________________, 20____,`);
  t(M, top - 28, "before me:");
  if (a.showNotary) t(M, top - 44, a.notaryText, 8, d.italic);
  const sig = top - 85;
  d.line(M, 280, sig);
  d.line(330, W - M, sig);
  t(M, sig - 12, a.commissionerTitle || "Signature of authority", 9);
  t(M, sig - 26, "Print name: ______________________", 9);
  t(M, sig - 40, "Official capacity: _________________", 9);
  t(330, sig - 12, `Signature of ${a.deponent}`, 9);
  d.y = sig - 60;
  if (a.footer) d.para(a.footer, { size: 8.5 });
}

export async function renderAffidavit(a: AffidavitData) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${affidavitTitle(a)} – ${a.servedUpon}`);
  const tr = a.template === "ns";
  const d = new Doc(
    pdf,
    await pdf.embedFont(tr ? StandardFonts.TimesRoman : StandardFonts.Helvetica),
    await pdf.embedFont(tr ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold),
    await pdf.embedFont(tr ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique)
  );
  if (tr) novaScotia(d, a);
  else standard(d, a);
  return pdf.save();
}
