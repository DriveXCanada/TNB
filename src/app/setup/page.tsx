import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="h1 mb-1">Welcome</h1>
        <p className="muted mb-6">Create the administrator account to get started.</p>
        <SetupForm />
      </div>
    </main>
  );
}
