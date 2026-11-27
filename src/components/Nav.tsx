import type { User } from "@prisma/client";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { can } from "@/lib/auth";
import NavLinks, { type NavItem } from "./NavLinks";

/** App shell: navy sidebar on desktop; top bar + bottom tab bar on phones. */
export default function Nav({ user, company, tagline }: { user: User; company: string; tagline: string }) {
  const items: NavItem[] = [
    ...(can(user, "viewDashboard") ? [{ href: "/", label: "Dashboard", icon: "dashboard" as const }] : []),
    { href: "/jobs", label: can(user, "viewAllJobs") ? "Jobs" : "My Jobs", icon: "jobs" },
    { href: "/field", label: "Field", icon: "field" },
    ...(can(user, "manageClients") ? [{ href: "/clients", label: "Clients", icon: "clients" as const }] : []),
    ...(can(user, "manageEmployees") ? [{ href: "/team", label: "Employees", icon: "team" as const }] : []),
    ...(can(user, "updateSettings") ? [{ href: "/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  const signOut = (
    <form action={logoutAction}>
      <button className="text-sm font-semibold text-navy-200 hover:text-white" title={user.email}>Sign out</button>
    </form>
  );
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-800 text-white lg:flex print:hidden">
        <div className="border-b border-navy-700 px-5 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark-light.png" alt="" className="mb-3 h-12 w-auto" />
          <div className="text-lg leading-tight font-extrabold tracking-wide uppercase">{company}</div>
          {tagline && <div className="mt-1 text-[11px] font-semibold tracking-[.12em] text-gold-400 uppercase">{tagline}</div>}
        </div>
        <NavLinks items={items} variant="sidebar" />
        <div className="mt-auto border-t border-navy-700 px-5 py-4">
          <div className="truncate text-sm font-bold">{user.name}</div>
          <div className="mb-2 truncate text-xs text-navy-300">{user.email}</div>
          <div className="flex gap-4">
            <Link href="/account" className="text-sm font-semibold text-gold-400 hover:text-gold-300">My account</Link>
            {signOut}
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-navy-800 px-4 text-white shadow-md lg:hidden print:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark-light.png" alt="" className="h-7 w-auto" />
        <div className="flex-1 truncate text-sm font-extrabold tracking-wide uppercase">{company}</div>
        <Link href="/account" className="text-sm font-semibold text-navy-100 hover:text-white">Account</Link>
      </header>

      {/* Phone bottom tabs */}
      <NavLinks items={items} variant="tabs" />
    </>
  );
}
