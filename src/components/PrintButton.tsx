"use client";
export default function PrintButton() {
  return <button className="btn-secondary print:hidden" onClick={() => window.print()}>Print</button>;
}
