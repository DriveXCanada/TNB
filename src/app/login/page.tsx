import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await prisma.user.count()) === 0) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(can(user, "viewDashboard") ? "/" : "/jobs");
  const s = await getSettings();
  return (
    <AuthShell company={s.companyName} tagline={s.tagline}>
      <div className="eyebrow mb-1">Team sign-in</div>
      <h2 className="h1 mb-6">Welcome back</h2>
      <LoginForm />
    </AuthShell>
  );
}
