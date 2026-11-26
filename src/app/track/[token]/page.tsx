import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTrackingData } from "@/lib/tracking";
import LiveTracker from "./LiveTracker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service status", robots: { index: false, follow: false } };

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getTrackingData(token);
  if (!data) notFound();
  return <LiveTracker token={token} initial={data} timeZone={process.env.APP_TIMEZONE || "America/Halifax"} />;
}
