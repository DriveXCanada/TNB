"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import {
  PERMISSION_COLUMNS,
  PERMISSION_HELP,
  PERMISSIONS,
  ROLE_INFO,
  ROLE_ORDER,
  ROLE_PRESETS,
  type Permission,
} from "@/lib/permissions";

export type EmployeeValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseExpires: string;
  timeZone: string;
  defaultServer: boolean;
  addressLine: string;
  addressUnit: string;
  city: string;
  province: string;
  postalCode: string;
  role: Role;
  permissions: string[];
  active: boolean;
};

const TIME_ZONES = [
  ["America/St_Johns", "(GMT-03:30) Newfoundland"],
  ["America/Halifax", "(GMT-04:00) Atlantic Time (Canada)"],
  ["America/Toronto", "(GMT-05:00) Eastern Time (Canada)"],
  ["America/Winnipeg", "(GMT-06:00) Central Time (Canada)"],
  ["America/Regina", "(GMT-06:00) Saskatchewan"],
  ["America/Edmonton", "(GMT-07:00) Mountain Time (Canada)"],
  ["America/Vancouver", "(GMT-08:00) Pacific Time (Canada)"],
];
const PROVINCES = ["NS", "NB", "PE", "NL", "QC", "ON", "MB", "SK", "AB", "BC", "YT", "NT", "NU"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
      <label className="text-sm text-slate-700">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function EmployeeForm({
  action,
  resendInvite,
  values,
  editorPermissions,
  editorIsOwner,
  isSelf,
  isNew,
  invitePending,
  inviteLink,
}: {
  action: (state: unknown, fd: FormData) => Promise<{ error: string } | undefined>;
  resendInvite?: () => Promise<void>;
  values: EmployeeValues;
  editorPermissions: Permission[];
  editorIsOwner: boolean;
  isSelf: boolean;
  isNew: boolean;
  invitePending: boolean;
  inviteLink?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [role, setRole] = useState<Role>(values.role);
  const [custom, setCustom] = useState<string[]>(values.role === "CUSTOM" ? values.permissions : ROLE_PRESETS[values.role]);
  const [showHelp, setShowHelp] = useState(false);
  const v = values;

  const checked = (p: Permission) => (role === "CUSTOM" ? custom.includes(p) : ROLE_PRESETS[role as Exclude<Role, "CUSTOM">].includes(p));
  const pickRole = (r: Role) => {
    if (r === "CUSTOM" && role !== "CUSTOM") setCustom(ROLE_PRESETS[role as Exclude<Role, "CUSTOM">] ?? []);
    setRole(r);
  };

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="card space-y-3">
          <h2 className="h2">Employee Info</h2>
          <Row label="First name"><input className="input" name="firstName" required defaultValue={v.firstName} /></Row>
          <Row label="Last name"><input className="input" name="lastName" defaultValue={v.lastName} /></Row>
          <Row label="Email"><input className="input" type="email" name="email" required defaultValue={v.email} /></Row>
          <Row label="Phone"><input className="input" type="tel" name="phone" defaultValue={v.phone} /></Row>
          <Row label="Date of Birth"><input className="input" type="date" name="dateOfBirth" defaultValue={v.dateOfBirth} /></Row>
          <Row label="License Number"><input className="input" name="licenseNumber" defaultValue={v.licenseNumber} /></Row>
          <Row label="License Expires"><input className="input" type="date" name="licenseExpires" defaultValue={v.licenseExpires} /></Row>
          <Row label="Time Zone">
            <select className="input" name="timeZone" defaultValue={v.timeZone || "America/Halifax"}>
              {TIME_ZONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Row>
          <Row label="">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="defaultServer" defaultChecked={v.defaultServer} className="h-4 w-4" /> Set as default server on new jobs
            </label>
          </Row>
        </section>
        <aside className="card h-fit space-y-2 bg-slate-50">
          <h3 className="font-semibold">Employee Invitation</h3>
          {isNew ? (
            <p className="text-sm text-slate-600">Each new employee receives an email invitation with instructions for setting their password. You can also set a password for them below instead.</p>
          ) : invitePending ? (
            <>
              <p className="text-sm text-slate-600">Invitation sent. They haven&apos;t set a password yet.</p>
              {inviteLink && <input className="input text-xs" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />}
              {resendInvite && <button formAction={resendInvite} formNoValidate className="btn-secondary w-full">Resend invitation</button>}
            </>
          ) : (
            <p className="text-sm text-slate-600">{v.role === "CONTACT" ? "Contacts can't sign in." : "This employee has set their password and can sign in."}</p>
          )}
        </aside>
      </div>

      <section className="card space-y-3">
        <h2 className="h2">Employee Address</h2>
        <Row label="Address">
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <input className="input" name="addressLine" defaultValue={v.addressLine} />
            <input className="input" name="addressUnit" defaultValue={v.addressUnit} placeholder="(apt, unit, etc.)" />
          </div>
        </Row>
        <Row label="City, Prov., Postal">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" name="city" defaultValue={v.city} placeholder="City (shown on affidavits)" />
            <select className="input" name="province" defaultValue={v.province || "NS"}>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <input className="input" name="postalCode" defaultValue={v.postalCode} placeholder="B3J 1Y9" />
          </div>
        </Row>
      </section>

      <section className="card space-y-1">
        <h2 className="h2 mb-2">Employee Permissions</h2>
        {isSelf && <p className="mb-2 rounded-md bg-slate-100 p-2 text-sm text-slate-600">You can&apos;t change your own permissions.</p>}
        <input type="hidden" name="role" value={role} />
        {ROLE_ORDER.map((r) => {
          const info = ROLE_INFO[r];
          const locked = isSelf || (r === "ADMIN" && !editorIsOwner) || (r !== "CUSTOM" && r !== "ADMIN" && ROLE_PRESETS[r].some((p) => !editorPermissions.includes(p)));
          const open = role === r && r !== "CONTACT";
          return (
            <div key={r} className={`border-t border-slate-100 py-3 ${open ? "rounded-lg bg-slate-50 px-2" : ""}`}>
              <label className={`flex gap-3 ${locked ? "opacity-50" : "cursor-pointer"}`}>
                <input type="radio" checked={role === r} disabled={locked} onChange={() => pickRole(r)} className="mt-1 h-4 w-4 shrink-0" />
                <span className="w-16 shrink-0 font-medium">{info.label}</span>
                <span className="text-sm"><b>{info.title}</b> {info.description}</span>
              </label>
              {open && (
                <div className="mt-3 ml-7 space-y-3">
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                    {PERMISSION_COLUMNS.map((col, i) => (
                      <div key={i} className="space-y-1">
                        {col.map((p) => {
                          const disabled = isSelf || role !== "CUSTOM" || !editorPermissions.includes(p);
                          return (
                            <label key={p} className={`flex items-start gap-2 text-sm ${disabled ? "text-slate-500" : ""}`}>
                              <input
                                type="checkbox"
                                name={role === "CUSTOM" ? "perm" : undefined}
                                value={p}
                                checked={checked(p)}
                                disabled={disabled}
                                onChange={(e) => setCustom((c) => (e.target.checked ? [...c, p] : c.filter((x) => x !== p)))}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span>
                                {PERMISSIONS[p]}
                                {showHelp && <span className="block text-xs text-slate-500">{PERMISSION_HELP[p]}</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm">
                    <button type="button" className="text-indigo-700 underline" onClick={() => setShowHelp((x) => !x)}>Permission Descriptions</button>
                    {role !== "CUSTOM" && !isSelf && <button type="button" className="text-indigo-700 underline" onClick={() => pickRole("CUSTOM")}>Customize This User</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Sign-in</h2>
        <Row label={isNew ? "Set password (optional)" : "New password"}>
          <input className="input" type="password" name="password" minLength={8} autoComplete="new-password" placeholder={isNew ? "Leave blank to email an invitation" : "Leave blank to keep the current password"} />
        </Row>
        {!isNew && !isSelf && (
          <Row label="">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={v.active} className="h-4 w-4" /> Active (can sign in)
            </label>
            <input type="hidden" name="active" value="off" />
          </Row>
        )}
      </section>

      {state?.error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button className="btn-primary px-8" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <Link href="/team" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
