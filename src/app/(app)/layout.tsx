import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <>
      <Nav user={user} company={settings.companyName} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
