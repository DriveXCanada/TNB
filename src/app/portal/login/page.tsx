import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getPortalUser } from "@/lib/portalAuth";
import AuthShell from "@/components/AuthShell";
import PortalLoginForm from "./PortalLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client Portal", robots: { index: false } };

export default async function PortalLoginPage() {
  if (await getPortalUser()) redirect("/portal");
  const s = await getSettings();
  return (
    <AuthShell company={s.companyName} tagline={s.tagline}>
      <div className="eyebrow mb-1">Client portal</div>
      <h2 className="h1 mb-1">Sign in</h2>
      <p className="muted mb-6">Sign in with your name and the PIN we gave you.</p>
      <PortalLoginForm />
      <p className="mt-6 text-center text-xs text-slate-500">Staff member? <Link className="link" href="/login">Team sign-in</Link></p>
    </AuthShell>
  );
}
