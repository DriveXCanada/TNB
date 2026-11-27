import Link from "next/link";
import { requirePortalUser } from "@/lib/portalAuth";
import { changePinAction } from "../../actions";
import SecretChangeForm from "@/components/SecretChangeForm";

export default async function PortalAccount() {
  const u = await requirePortalUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/portal" className="link text-sm">← All jobs</Link>
      <div>
        <div className="eyebrow">{u.client.name}</div>
        <h1 className="h1">Change your PIN</h1>
        <p className="muted">You sign in as <b className="text-navy-900">{u.name}</b>.</p>
      </div>
      <section className="card">
        <SecretChangeForm action={changePinAction} kind="pin" />
      </section>
    </div>
  );
}
