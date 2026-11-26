import Link from "next/link";
import type { User } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { can } from "@/lib/auth";

export default function Nav({ user, company }: { user: User; company: string }) {
  const links = [
    ...(can(user, "viewDashboard") ? [["/", "Dashboard"]] : []),
    ["/jobs", can(user, "viewAllJobs") ? "Jobs" : "My jobs"],
    ["/field", "Field"],
    ...(can(user, "manageClients") ? [["/clients", "Clients"]] : []),
    ...(can(user, "manageEmployees") ? [["/team", "Employees"]] : []),
    ...(can(user, "updateSettings") ? [["/settings", "Settings"]] : []),
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href={can(user, "viewDashboard") ? "/" : "/jobs"} className="mr-2 hidden truncate font-bold text-indigo-700 sm:block">{company}</Link>
        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <button className="text-sm whitespace-nowrap text-slate-500 hover:text-slate-800" title={user.email}>Sign out</button>
        </form>
      </div>
    </header>
  );
}
