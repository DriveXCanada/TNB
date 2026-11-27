"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, LayoutDashboard, MapPinned, Settings, Users } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, jobs: Briefcase, field: MapPinned, clients: Building2, team: Users, settings: Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export default function NavLinks({ items, variant }: { items: NavItem[]; variant: "sidebar" | "tabs" }) {
  const path = usePathname();
  if (variant === "sidebar") {
    return (
      <nav className="flex flex-col gap-1 px-3 py-4">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const on = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-[15px] font-bold transition ${
                on ? "border-gold-500 bg-navy-700 text-white" : "border-transparent text-navy-100 hover:bg-navy-700/60 hover:text-white"
              }`}
            >
              <Icon className={`h-5 w-5 ${on ? "text-gold-400" : ""}`} strokeWidth={2.25} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  // Phone: show up to 5 tabs; the rest stay reachable from the desktop layout or links.
  const tabs = items.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 border-t-2 border-gold-500 bg-navy-800 pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((it) => {
        const Icon = ICONS[it.icon];
        const on = isActive(path, it.href);
        return (
          <Link key={it.href} href={it.href} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${on ? "text-gold-400" : "text-navy-100"}`}>
            <Icon className="h-6 w-6" strokeWidth={2.25} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
