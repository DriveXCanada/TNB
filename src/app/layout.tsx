import type { Metadata, Viewport } from "next";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-sans/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vantage Security Consulting",
  description: "Process serving: jobs, attempts, affidavits and live client tracking",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#132d4c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
