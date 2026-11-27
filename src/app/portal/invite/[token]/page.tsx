import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { acceptPortalInviteAction } from "../../actions";
import AuthShell from "@/components/AuthShell";
import InviteForm from "@/app/invite/[token]/InviteForm";

export const dynamic = "force-dynamic";

export default async function PortalInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [u, s] = await Promise.all([prisma.portalUser.findUnique({ where: { inviteToken: token }, include: { client: true } }), getSettings()]);
  const valid = u && u.inviteExpires && u.inviteExpires > new Date() && u.active;
  return (
    <AuthShell company={s.companyName} tagline={s.tagline}>
      <div className="eyebrow mb-1">Client portal</div>
      {valid ? (
        <>
          <h2 className="h1 mb-1">Welcome, {u.name}</h2>
          <p className="muted mb-6">Choose a password for {u.email} ({u.client.name}).</p>
          <InviteForm action={acceptPortalInviteAction.bind(null, token)} />
        </>
      ) : (
        <>
          <h2 className="h1 mb-1">Link expired</h2>
          <p className="muted">This link is no longer valid. Contact us and we&apos;ll send a new one.</p>
        </>
      )}
    </AuthShell>
  );
}
