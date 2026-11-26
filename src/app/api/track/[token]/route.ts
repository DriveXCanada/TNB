import { getTrackingData } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getTrackingData(token);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
