"use client";

import { useEffect, useRef } from "react";

/** PDF preview with Print and Download. After a save, the PDF also downloads to this computer automatically. */
export default function AffidavitViewer({ pdfUrl, autoDownload }: { pdfUrl: string; autoDownload: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const dl = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!autoDownload) return;
    dl.current?.click();
    // Drop ?saved=1 so a refresh doesn't download again.
    window.history.replaceState(null, "", window.location.pathname);
  }, [autoDownload]);

  const print = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={print}>🖨 Print</button>
        <a ref={dl} className="btn-secondary" href={`${pdfUrl}?download=1`} download>⬇ Download</a>
        <a className="btn-secondary" href={pdfUrl} target="_blank">Open in new tab</a>
      </div>
      <iframe ref={frame} src={pdfUrl} title="Affidavit PDF" className="h-[80vh] w-full rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}
