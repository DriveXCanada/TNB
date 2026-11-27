import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { effectivePermissions } from "@/lib/permissions";
import { saveEmployeeAction } from "@/app/actions";
import EmployeeForm, { type EmployeeValues } from "@/components/EmployeeForm";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const me = await requirePerm("manageEmployees");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const u = isNew ? null : await prisma.user.findUnique({ where: { id } });
  if (!isNew && !u) notFound();
  const [first, ...rest] = (u?.name ?? "").split(" ");
  const values: EmployeeValues = {
    firstName: u?.firstName ?? first ?? "",
    lastName: u?.lastName ?? rest.join(" "),
    email: u?.email ?? "",
    phone: u?.phone ?? "",
    dateOfBirth: day(u?.dateOfBirth ?? null),
    licenseNumber: u?.licenseNumber ?? "",
    licenseExpires: day(u?.licenseExpires ?? null),
    timeZone: u?.timeZone ?? "America/Halifax",
    defaultServer: u?.defaultServer ?? false,
    addressLine: u?.addressLine ?? "",
    addressUnit: u?.addressUnit ?? "",
    city: u?.city ?? "",
    province: u?.province ?? "NS",
    postalCode: u?.postalCode ?? "",
    role: u?.role ?? "SERVER",
    permissions: u?.permissions ?? [],
    active: u?.active ?? true,
  };
  const noPassword = Boolean(u && !u.passwordHash && u.role !== "CONTACT");
  const ownerOnly = u?.role === "ADMIN" && me.role !== "ADMIN";
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {sp.saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✓ Saved.</div>}
      <h1 className="h1">{isNew ? "New Employee" : u!.name}</h1>
      {ownerOnly ? (
        <p className="card text-sm">Only an Owner can edit another Owner.</p>
      ) : (
        <EmployeeForm
          action={saveEmployeeAction.bind(null, isNew ? null : id)}
          values={values}
          editorPermissions={effectivePermissions(me)}
          editorIsOwner={me.role === "ADMIN"}
          isSelf={u?.id === me.id}
          isNew={isNew}
          noPassword={noPassword}
        />
      )}
    </div>
  );
}
