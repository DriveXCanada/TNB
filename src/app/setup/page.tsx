import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import AuthShell from "@/components/AuthShell";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  const s = await getSettings();
  return (
    <AuthShell company={s.companyName} tagline={s.tagline}>
      <div className="eyebrow mb-1">First-time setup</div>
      <h2 className="h1 mb-1">Create the Owner account</h2>
      <p className="muted mb-6">This account has full access, including employees and settings.</p>
      <SetupForm />
    </AuthShell>
  );
}
