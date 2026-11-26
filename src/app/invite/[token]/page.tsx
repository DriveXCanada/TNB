import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { acceptInviteAction } from "@/app/actions";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [u, settings] = await Promise.all([prisma.user.findUnique({ where: { inviteToken: token } }), getSettings()]);
  const valid = u && u.inviteExpires && u.inviteExpires > new Date() && u.active && u.role !== "CONTACT";
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-1 font-bold text-indigo-700">{settings.companyName}</div>
        {valid ? (
          <>
            <h1 className="h1 mb-1">Welcome, {u.firstName || u.name}</h1>
            <p className="muted mb-6">Choose a password for {u.email}.</p>
            <InviteForm action={acceptInviteAction.bind(null, token)} />
          </>
        ) : (
          <>
            <h1 className="h1 mb-1">Link expired</h1>
            <p className="muted">This invitation link is no longer valid. Ask your office to send a new one.</p>
          </>
        )}
      </div>
    </main>
  );
}
