import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <>
      <Nav user={user} company={settings.companyName} tagline={settings.tagline} />
      <div className="pb-20 lg:pb-0 lg:pl-64 print:p-0">
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </>
  );
}
