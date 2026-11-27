import Link from "next/link";
import { requirePortalUser } from "@/lib/portalAuth";
import { getSettings } from "@/lib/settings";
import { portalLogoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client Portal", robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [u, s] = await Promise.all([requirePortalUser(), getSettings()]);
  return (
    <>
      <header className="border-b-4 border-gold-500 bg-navy-800 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/portal" className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark-light.png" alt="" className="h-9 w-auto" />
            <div className="min-w-0">
              <div className="truncate font-extrabold tracking-wide uppercase">{s.companyName}</div>
              <div className="truncate text-[11px] font-semibold tracking-[.12em] text-gold-400 uppercase">Client portal · {u.client.name}</div>
            </div>
          </Link>
          <div className="hidden text-right text-sm sm:block">
            <div className="font-bold">{u.name}</div>
            <Link href="/portal/account" className="text-xs font-semibold text-gold-400 hover:text-gold-300">Change PIN</Link>
          </div>
          <Link href="/portal/account" className="text-sm font-semibold text-navy-200 hover:text-white sm:hidden">PIN</Link>
          <form action={portalLogoutAction}><button className="text-sm font-semibold text-navy-200 hover:text-white">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-500">
        Questions about a job? {s.companyPhone && <a className="link" href={`tel:${s.companyPhone}`}>{s.companyPhone}</a>}
        {s.companyPhone && s.companyEmail && " · "}
        {s.companyEmail && <a className="link" href={`mailto:${s.companyEmail}`}>{s.companyEmail}</a>}
      </footer>
    </>
  );
}
