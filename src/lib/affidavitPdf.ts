import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { affidavitTitle, type AffidavitData } from "./affidavitData";

const W = 612, H = 792, M = 54;
const GREY = rgb(0.88, 0.9, 0.93);

/** A photo to attach as an exhibit page after the affidavit. */
export type AffidavitPhoto = { data: Buffer; mimeType: string; caption: string };

/** pdf-lib's standard fonts only cover WinAnsi; swap characters it can't draw. */
function clean(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x0A\x20-\x7E\xA0-\xFF–—•…€]/g, "");
}

/** For text drawn on a single line: line breaks become spaces (the font can't encode them). */
function one(s: string) {
  return clean(s).replace(/\s*\n+\s*/g, " ");
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

/**
 * One page of affidavit. Every size and gap is multiplied by `k`, so the whole page can be
 * shrunk until it fits. Nothing here adds a page: `overflow` records whether content ran off.
 */
class Page {
  y = H - M;
  overflow = false;
  constructor(public page: PDFPage, public font: PDFFont, public bold: PDFFont, public italic: PDFFont, public k: number) {}
  s(n: number) {
    return n * this.k;
  }
  text(str: string, x: number, y: number, size: number, font = this.font) {
    if (y < M - 2) this.overflow = true;
    this.page.drawText(one(str), { x, y, size, font, color: rgb(0, 0, 0) });
  }
  para(text: string, o: { x?: number; width?: number; size?: number; font?: PDFFont; gap?: number; center?: boolean; right?: boolean } = {}) {
    const size = this.s(o.size ?? 10), font = o.font ?? this.font, x = o.x ?? M, width = o.width ?? W - M - x;
    for (const l of wrap(text, font, size, width)) {
      const tw = font.widthOfTextAtSize(l, size);
      this.text(l, o.center ? x + (width - tw) / 2 : o.right ? x + width - tw : x, this.y - size, size, font);
      this.y -= size + this.s(3);
    }
    this.y -= this.s(o.gap ?? 6);
  }
  line(x1: number, x2: number, y: number) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color: rgb(0, 0, 0) });
  }
}

/** Grid of labelled cells, like a court-form header table. */
function table(p: Page, rows: { label: string; value: string }[][]) {
  const width = W - 2 * M, fs = p.s(10), ls = p.s(13);
  for (const row of rows) {
    const cw = width / row.length;
    const h = Math.max(...row.map((c) => p.s(18) + wrap(c.value || " ", p.font, fs, cw - 10).length * ls));
    row.forEach((c, i) => {
      const x = M + i * cw;
      p.page.drawRectangle({ x, y: p.y - h, width: cw, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.7 });
      p.text(c.label, x + 5, p.y - p.s(11), p.s(8.5), p.bold);
      wrap(c.value || " ", p.font, fs, cw - 10).forEach((l, j) => p.text(l, x + 5, p.y - p.s(24) - j * ls, fs));
    });
    p.y -= h;
  }
  p.y -= p.s(12);
}

function labelled(p: Page, label: string, value: string) {
  const lw = 135, fs = p.s(10), ls = p.s(13);
  const lines = wrap(value || " ", p.font, fs, W - 2 * M - lw);
  p.text(label, M, p.y - fs, fs, p.bold);
  lines.forEach((l, i) => p.text(l, M + lw, p.y - fs - i * ls, fs));
  p.y -= lines.length * ls + p.s(4);
}

/** Which exhibit letter the photos get: "A", or "B" when the NS layout already uses "A" for the documents. */
export function photoExhibitLetter(a: AffidavitData) {
  return a.template === "ns" && a.kind === "SERVICE" ? "B" : "A";
}

function photoSentence(a: AffidavitData, count: number) {
  const ex = photoExhibitLetter(a);
  return count === 1
    ? `Attached as Exhibit "${ex}" is a photograph taken during the attempts described above.`
    : `Attached as Exhibit "${ex}" are ${count} photographs taken during the attempts described above.`;
}

function standard(p: Page, a: AffidavitData, photoCount: number) {
  p.page.drawRectangle({ x: M, y: p.y - p.s(22), width: W - 2 * M, height: p.s(22), color: GREY });
  p.para(affidavitTitle(a), { size: 13, font: p.bold, center: true, x: M, width: W - 2 * M, gap: 4 });
  p.y -= p.s(8);
  table(p, [
    [{ label: "Case:", value: a.caseNo }, { label: "Court:", value: a.court }, { label: "County:", value: a.county }, { label: "Job:", value: a.jobRef }],
    [{ label: "Plaintiff / Petitioner:", value: a.plaintiff }, { label: "Defendant / Respondent:", value: a.defendant }],
    [{ label: "Received by:", value: a.receivedBy }, { label: "For:", value: a.forClient }],
    [{ label: "To be served upon:", value: a.servedUpon }],
  ]);
  p.para(a.statement, { gap: 12 });
  labelled(p, "Recipient Name / Address:", a.recipientAddress);
  labelled(p, "Manner of Service:", a.manner);
  labelled(p, "Documents:", a.documents);
  p.y -= p.s(8);
  if (a.comments.trim()) {
    p.para("Additional Comments:", { font: p.bold, gap: 2 });
    p.para(a.comments, { gap: 10 });
  }
  if (photoCount) p.para(photoSentence(a, photoCount), { gap: 10 });
  if (a.includeFees && a.fees.trim()) p.para(a.fees, { gap: 10 });

  // Signature blocks
  const top = p.y - p.s(40);
  p.line(M, M + 170, top);
  p.line(M + 185, M + 255, top);
  p.text(a.deponent, M, top - p.s(12), p.s(10));
  p.text("Date", M + 185, top - p.s(12), p.s(10), p.bold);
  let bottom = top - p.s(12);
  if (a.showNotary) {
    const x = 330, ns = p.s(8.5);
    wrap(a.notaryText, p.italic, ns, W - M - x).forEach((l, i) => p.text(l, x, top + p.s(22) - i * p.s(11), ns, p.italic));
    p.line(x, W - M, top - p.s(20));
    p.text("Commissioner of Oaths", x, top - p.s(32), p.s(10), p.bold);
    p.line(x, W - M, top - p.s(62));
    p.text("Date", x, top - p.s(74), p.s(10), p.bold);
    bottom = top - p.s(74);
  }
  p.y = bottom - p.s(14);
  if (a.footer) p.para(a.footer, { size: 8.5 });
}

function novaScotia(p: Page, a: AffidavitData, photoCount: number) {
  const blank = "____________________";
  p.para(a.caseNo || "20__ Hfx No. __________", { right: true, gap: 12 });
  p.para(a.court || "Supreme Court of Nova Scotia", { font: p.bold, size: 13, center: true, gap: 10 });
  p.para("Between:", { gap: 4 });
  p.para(a.plaintiff || blank, { font: p.bold, center: true, gap: 0 });
  p.para("Plaintiff", { right: true, gap: 2 });
  p.para("and", { center: true, gap: 2 });
  p.para(a.defendant || blank, { font: p.bold, center: true, gap: 0 });
  p.para("Defendant", { right: true, gap: 12 });
  p.para(a.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service", { font: p.bold, size: 14, center: true, gap: 12 });
  p.para(a.statement, { gap: 10 });
  labelled(p, "Recipient / Address:", a.recipientAddress);
  labelled(p, "Manner of Service:", a.manner);
  labelled(p, "Documents:", a.documents);
  if (a.kind === "SERVICE") labelled(p, "Exhibit:", `Exhibit "A" to this affidavit is a true copy of the documents delivered.`);
  p.y -= p.s(6);
  if (a.comments.trim()) {
    p.para("Attempts:", { font: p.bold, gap: 2 });
    p.para(a.comments, { gap: 10 });
  }
  if (photoCount) p.para(photoSentence(a, photoCount), { gap: 10 });
  if (a.includeFees && a.fees.trim()) p.para(a.fees, { gap: 10 });

  const top = p.y - p.s(6), fs = p.s(10), ss = p.s(9);
  p.text("Sworn to [or Affirmed] at ________________,", M, top, fs);
  p.text(`${a.province || "Nova Scotia"}, on ________________, 20____,`, M, top - p.s(14), fs);
  p.text("before me:", M, top - p.s(28), fs);
  if (a.showNotary) p.text(a.notaryText, M, top - p.s(44), p.s(8), p.italic);
  const sig = top - p.s(80);
  p.line(M, 280, sig);
  p.line(330, W - M, sig);
  p.text(a.commissionerTitle || "Signature of authority", M, sig - p.s(12), ss);
  p.text("Print name: ______________________", M, sig - p.s(26), ss);
  p.text("Official capacity: _________________", M, sig - p.s(40), ss);
  p.text(`Signature of ${a.deponent}`, 330, sig - p.s(12), ss);
  p.y = sig - p.s(52);
  if (a.footer) p.para(a.footer, { size: 8.5 });
}

async function fonts(pdf: PDFDocument, times: boolean) {
  return Promise.all([
    pdf.embedFont(times ? StandardFonts.TimesRoman : StandardFonts.Helvetica),
    pdf.embedFont(times ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold),
    pdf.embedFont(times ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique),
  ]);
}

/** Draw the affidavit at scale k onto a fresh one-page document; report whether it fit. */
async function tryPage(a: AffidavitData, k: number, photoCount: number) {
  const pdf = await PDFDocument.create();
  const [f, b, i] = await fonts(pdf, a.template === "ns");
  const p = new Page(pdf.addPage([W, H]), f, b, i, k);
  if (a.template === "ns") novaScotia(p, a, photoCount);
  else standard(p, a, photoCount);
  return { pdf, fits: !p.overflow && p.y >= M - 2 };
}

const SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.76, 0.72, 0.68];

/** The affidavit is always exactly one page: shrink the text, and as a last resort trim the oldest comment lines. */
async function onePage(a: AffidavitData, photoCount: number) {
  for (const k of SCALES) {
    const r = await tryPage(a, k, photoCount);
    if (r.fits) return r.pdf;
  }
  const k = SCALES[SCALES.length - 1];
  const lines = a.comments.split("\n");
  const note = "… earlier attempts omitted to keep this affidavit to one page.";
  while (lines.length > 1) {
    lines.splice(0, 1);
    const r = await tryPage({ ...a, comments: [note, ...lines].join("\n") }, k, photoCount);
    if (r.fits) return r.pdf;
  }
  // Still too long without comments (e.g. a very long statement typed in): shorten the longest
  // text field a bit at a time until it fits, so the signature block is never pushed off the page.
  let cur: AffidavitData = { ...a, comments: "" };
  const FIELDS = [
    "statement", "documents", "manner", "recipientAddress", "notaryText", "footer", "fees",
    "caseNo", "court", "county", "jobRef", "plaintiff", "defendant", "receivedBy", "forClient", "servedUpon", "deponent",
    "province", "commissionerTitle",
  ] as const;
  for (let i = 0; i < 200; i++) {
    const r = await tryPage(cur, k, photoCount);
    if (r.fits) return r.pdf;
    const longest = FIELDS.reduce((m, f) => (cur[f].length > cur[m].length ? f : m), FIELDS[0]);
    const v = cur[longest];
    if (v.length < 40) break;
    cur = { ...cur, [longest]: v.slice(0, Math.floor(v.length * 0.7)).replace(/\s+\S*$/, "") + " …" };
  }
  // Last resort: every field capped short and kept on one line. The layout itself always fits at this size.
  const capped = { ...cur } as AffidavitData;
  for (const f of FIELDS) capped[f] = one(cur[f]).slice(0, 90);
  return (await tryPage(capped, k, photoCount)).pdf;
}

/** Exhibit pages: two photos per page, each captioned, with the commissioner's exhibit line. */
async function addPhotoPages(pdf: PDFDocument, a: AffidavitData, photos: AffidavitPhoto[]) {
  const [font, bold, italic] = await fonts(pdf, a.template === "ns");
  const ex = photoExhibitLetter(a);
  const images: { img: PDFImage; caption: string }[] = [];
  for (const ph of photos) {
    try {
      const img = ph.mimeType === "image/png" ? await pdf.embedPng(ph.data) : await pdf.embedJpg(ph.data);
      images.push({ img, caption: ph.caption });
    } catch {
      // Not a JPEG/PNG (e.g. HEIC or PDF): skip it rather than fail the affidavit.
    }
  }
  const perPage = 2;
  const pages = Math.ceil(images.length / perPage);
  for (let pi = 0; pi < pages; pi++) {
    const page = pdf.addPage([W, H]);
    const t = (s: string, x: number, y: number, size: number, f = font) => page.drawText(one(s), { x, y, size, font: f, color: rgb(0, 0, 0) });
    const head = `Exhibit "${ex}" – Photographs${pages > 1 ? ` (page ${pi + 1} of ${pages})` : ""}`;
    t(head, (W - bold.widthOfTextAtSize(one(head), 13)) / 2, H - M - 4, 13, bold);
    const sub = `${a.servedUpon}${a.caseNo ? ` · ${a.caseNo}` : ""}${a.jobRef ? ` · ${a.jobRef}` : ""}`;
    t(sub, (W - font.widthOfTextAtSize(one(sub), 9)) / 2, H - M - 18, 9);

    const top = H - M - 34, bottomReserve = 80, slotH = (top - (M + bottomReserve)) / perPage;
    images.slice(pi * perPage, pi * perPage + perPage).forEach(({ img, caption }, i) => {
      const boxW = W - 2 * M, boxH = slotH - 26;
      const sc = Math.min(boxW / img.width, boxH / img.height, 1.5);
      const w = img.width * sc, h = img.height * sc;
      const yTop = top - i * slotH;
      page.drawImage(img, { x: (W - w) / 2, y: yTop - h - 4, width: w, height: h });
      page.drawRectangle({ x: (W - w) / 2, y: yTop - h - 4, width: w, height: h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
      const num = pi * perPage + i + 1;
      t(`Photo ${num}: ${caption}`, M, yTop - h - 18, 9, italic);
    });

    // Exhibit stamp for the commissioner
    const y = M + 52;
    t(`This is Exhibit "${ex}" referred to in the affidavit of ${a.deponent || "______________"}`, M, y, 9);
    t("sworn [or affirmed] before me on ______________________.", M, y - 12, 9);
    page.drawLine({ start: { x: M, y: M + 6 }, end: { x: M + 220, y: M + 6 }, thickness: 0.7 });
    t(a.template === "ns" ? a.commissionerTitle || "Signature of authority" : "Commissioner of Oaths", M, M - 6, 9, bold);
  }
}

export async function renderAffidavit(a: AffidavitData, photos: AffidavitPhoto[] = []) {
  const pdf = await onePage(a, photos.length);
  pdf.setTitle(`${affidavitTitle(a)} – ${a.servedUpon}`);
  if (photos.length) await addPhotoPages(pdf, a, photos);
  return pdf.save();
}
