import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { mailEnabled } from "@/lib/mail";
import { saveSettingsAction } from "@/app/actions";

const PROVINCES = ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Northwest Territories", "Nunavut", "Yukon"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePerm("updateSettings");
  const s = await getSettings();
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">Settings</h1>
      {sp.saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Settings saved.</div>}
      <form action={saveSettingsAction} className="space-y-6">
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="h2 sm:col-span-2">Company</h2>
          <div className="sm:col-span-2"><label className="label">Company name</label><input className="input" name="companyName" defaultValue={s.companyName} /></div>
          <div><label className="label">Phone</label><input className="input" name="companyPhone" defaultValue={s.companyPhone} /></div>
          <div><label className="label">Email</label><input className="input" name="companyEmail" defaultValue={s.companyEmail} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" name="companyAddress" defaultValue={s.companyAddress} /></div>
        </section>

        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="h2 sm:col-span-2">Affidavit of service</h2>
          <div>
            <label className="label">Province</label>
            <select className="input" name="province" defaultValue={s.province}>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div><label className="label">Default court</label><input className="input" name="defaultCourt" defaultValue={s.defaultCourt} placeholder="Court of King's Bench of Alberta" /></div>
          <div className="sm:col-span-2"><label className="label">Oath wording</label><input className="input" name="oathPhrase" defaultValue={s.oathPhrase} /></div>
          <div className="sm:col-span-2"><label className="label">Commissioner signature line</label><input className="input" name="commissionerTitle" defaultValue={s.commissionerTitle} /></div>
          <div className="sm:col-span-2"><label className="label">Standard affidavit statement ({"{name}"} = server&apos;s name)</label><textarea className="input" rows={4} name="affidavitStatement" defaultValue={s.affidavitStatement} /></div>
          <div className="sm:col-span-2"><label className="label">Notary block text</label><input className="input" name="notaryText" defaultValue={s.notaryText} /></div>
          <div className="sm:col-span-2"><label className="label">Footer text (optional)</label><textarea className="input" rows={2} name="affidavitFooter" defaultValue={s.affidavitFooter} /></div>
          <p className="muted sm:col-span-2">Check the generated wording against your province&apos;s rules of court and forms before you swear an affidavit.</p>
        </section>

        <section className="card space-y-3">
          <h2 className="h2">Client tracking</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sharePhotosWithClient" defaultChecked={s.sharePhotosWithClient === "true"} className="h-4 w-4" />
            Show attempt photos on client tracking pages
          </label>
          <p className="muted">
            Email notifications: {mailEnabled() ? "enabled (SMTP is configured)." : "off. Set the SMTP_HOST and SMTP_FROM environment variables to turn them on."}
          </p>
        </section>

        <button className="btn-primary">Save settings</button>
      </form>
    </div>
  );
}
