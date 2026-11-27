import { requireUser } from "@/lib/auth";
import { ROLE_INFO } from "@/lib/permissions";
import { changePasswordAction, logoutAction } from "@/app/actions";
import SecretChangeForm from "@/components/SecretChangeForm";

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="eyebrow">My account</div>
        <h1 className="h1">{me.name}</h1>
        <p className="muted">{me.email} · {ROLE_INFO[me.role].label}</p>
      </div>
      <section className="card space-y-3">
        <h2 className="h2">Change password</h2>
        <SecretChangeForm action={changePasswordAction} kind="password" />
      </section>
      <form action={logoutAction}>
        <button className="btn-secondary w-full">Sign out</button>
      </form>
    </div>
  );
}
