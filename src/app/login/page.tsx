import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await prisma.user.count()) === 0) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/" : "/field");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="h1 mb-1">Sign in</h1>
        <p className="muted mb-6">Process serving management</p>
        <LoginForm />
      </div>
    </main>
  );
}
