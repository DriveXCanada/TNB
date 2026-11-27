"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import type { AttemptOutcome, JobStatus, Priority, Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canAccessJob,
  createSession,
  destroySession,
  hashPassword,
  requirePerm,
  isStaff,
  can,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { storeUploads } from "@/lib/files";
import { saveSettings, DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { effectivePermissions, PERMISSIONS, ROLE_PRESETS, type Permission } from "@/lib/permissions";
import { checkPin, normalizeLoginName } from "@/lib/pin";
import { isServedOutcome, jobNo, OUTCOME_LABEL, fmtDateTime } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { defaultAffidavit, sanitizeAffidavit } from "@/lib/affidavitData";
import { renderAffidavit } from "@/lib/affidavitPdf";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const req = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const files = (fd: FormData, k: string) => fd.getAll(k).filter((f): f is File => f instanceof File && f.size > 0);

/* ---------- auth ---------- */

export async function loginAction(_: unknown, fd: FormData) {
  const email = (str(fd, "email") ?? "").toLowerCase();
  const password = str(fd, "password") ?? "";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || user.role === "CONTACT" || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect(can(user, "viewDashboard") ? "/" : "/jobs");
}

export async function setupAction(_: unknown, fd: FormData) {
  if ((await prisma.user.count()) > 0) redirect("/login");
  const password = req(fd, "password");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const user = await prisma.user.create({
    data: {
      name: req(fd, "name"),
      firstName: req(fd, "name").split(" ")[0],
      lastName: req(fd, "name").split(" ").slice(1).join(" "),
      email: req(fd, "email").toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    },
  });
  const company = str(fd, "companyName");
  if (company) await saveSettings({ companyName: company });
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/* ---------- jobs ---------- */

/** Date-only fields are stored at noon UTC so they show as the same calendar day in any Canadian timezone. */
const day = (v: string | null) => (v ? new Date(`${v}T12:00:00Z`) : null);

function jobData(fd: FormData) {
  const fee = str(fd, "fee");
  const due = str(fd, "dueDate");
  return {
    recipientName: req(fd, "recipientName"),
    recipientType: str(fd, "recipientType") ?? "INDIVIDUAL",
    recipientDescription: str(fd, "recipientDescription"),
    address: req(fd, "address"),
    altAddresses: str(fd, "altAddresses"),
    clientId: str(fd, "clientId"),
    clientReference: str(fd, "clientReference"),
    courtName: str(fd, "courtName"),
    courtFileNumber: str(fd, "courtFileNumber"),
    courtCounty: str(fd, "courtCounty"),
    plaintiff: str(fd, "plaintiff"),
    defendant: str(fd, "defendant"),
    dateFiled: day(str(fd, "dateFiled")),
    courtDate: day(str(fd, "courtDate")),
    recipientEmail: str(fd, "recipientEmail"),
    recipientPhone: str(fd, "recipientPhone"),
    documentsServed: str(fd, "documentsServed"),
    instructions: str(fd, "instructions"),
    priority: (str(fd, "priority") ?? "ROUTINE") as Priority,
    dueDate: due ? new Date(`${due}T23:59:00`) : null,
    fee: fee ? fee : null,
    serverId: str(fd, "serverId"),
  };
}

export async function createJobAction(fd: FormData) {
  const me = await requirePerm("manageJobs");
  const job = await prisma.job.create({
    data: { ...jobData(fd), createdById: me.id, trackingToken: randomBytes(18).toString("base64url") },
  });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: job.id });
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(id: string, fd: FormData) {
  await requirePerm("manageJobs");
  await prisma.job.update({ where: { id }, data: jobData(fd) });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: id });
  redirect(`/jobs/${id}`);
}

export async function setJobStatusAction(id: string, fd: FormData) {
  await requirePerm("manageJobs");
  const status = req(fd, "status") as JobStatus;
  await prisma.job.update({
    where: { id },
    data: { status, servedAt: status === "SERVED" ? new Date() : undefined },
  });
  revalidatePath(`/jobs/${id}`);
}

export async function assignServerAction(id: string, fd: FormData) {
  await requirePerm("manageJobs");
  await prisma.job.update({ where: { id }, data: { serverId: str(fd, "serverId") } });
  revalidatePath(`/jobs/${id}`);
}

export async function toggleTrackingAction(id: string) {
  await requirePerm("manageJobs");
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  await prisma.job.update({ where: { id }, data: { trackingEnabled: !job.trackingEnabled } });
  revalidatePath(`/jobs/${id}`);
}

export async function regenerateTrackingAction(id: string) {
  await requirePerm("manageJobs");
  await prisma.job.update({ where: { id }, data: { trackingToken: randomBytes(18).toString("base64url") } });
  revalidatePath(`/jobs/${id}`);
}

export async function deleteJobAction(id: string) {
  await requirePerm("manageJobs");
  await prisma.job.delete({ where: { id } });
  redirect("/jobs");
}

export async function deleteFileAction(fileId: string, jobId: string) {
  await requirePerm("manageJobs");
  await prisma.file.delete({ where: { id: fileId } });
  revalidatePath(`/jobs/${jobId}`);
}

/* ---------- attempts ---------- */

function attemptData(fd: FormData, fallbackAddress: string) {
  const num = (k: string) => {
    const v = str(fd, k);
    return v && !Number.isNaN(Number(v)) ? Number(v) : null;
  };
  const when = str(fd, "attemptedAt");
  const addr = str(fd, "address");
  return {
    attemptedAt: when ? new Date(when) : new Date(),
    address: addr === "__new" ? (str(fd, "newAddress") ?? fallbackAddress) : (addr ?? fallbackAddress),
    outcome: req(fd, "outcome") as AttemptOutcome,
    personServed: str(fd, "personServed"),
    ...(fd.has("relationship") ? { relationship: str(fd, "relationship") } : {}),
    personDescription: str(fd, "personDescription"),
    identifiedBy: str(fd, "identifiedBy"),
    notes: str(fd, "notes"),
    shareWithClient: fd.get("shareWithClient") === "on",
  };
}

/** Staff can record an attempt for any active team member; servers always record their own. */
async function pickServer(user: User, fd: FormData) {
  const chosen = str(fd, "serverId");
  if (!chosen || !can(user, "manageJobs") || chosen === user.id) return user.id;
  const exists = await prisma.user.findFirst({ where: { id: chosen, active: true } });
  return exists ? chosen : user.id;
}

function returnPath(fd: FormData, jobId: string) {
  const r = str(fd, "returnTo");
  return r && (r.startsWith("/jobs/") || r.startsWith("/field/")) ? r : `/jobs/${jobId}`;
}

async function syncJobStatus(jobId: string) {
  const attempts = await prisma.attempt.findMany({ where: { jobId }, orderBy: { attemptedAt: "desc" } });
  const servedA = attempts.find((x) => isServedOutcome(x.outcome));
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (servedA) await prisma.job.update({ where: { id: jobId }, data: { status: "SERVED", servedAt: servedA.attemptedAt } });
  else if (job.status === "PENDING" && attempts.length) await prisma.job.update({ where: { id: jobId }, data: { status: "IN_PROGRESS" } });
  else if (job.status === "SERVED") await prisma.job.update({ where: { id: jobId }, data: { status: attempts.length ? "IN_PROGRESS" : "PENDING", servedAt: null } });
}

export async function createAttemptAction(jobId: string, fd: FormData) {
  const user = await requirePerm("createAttempts");
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (!canAccessJob(user, job)) throw new Error("Not allowed");

  const n = (k: string) => {
    const v = str(fd, k);
    return v && !Number.isNaN(Number(v)) ? Number(v) : null;
  };
  const attempt = await prisma.attempt.create({
    data: {
      ...attemptData(fd, job.address),
      jobId,
      serverId: await pickServer(user, fd),
      latitude: n("latitude"),
      longitude: n("longitude"),
      gpsAccuracy: n("gpsAccuracy"),
    },
  });
  await storeUploads(files(fd, "photos"), "PHOTO", { attemptId: attempt.id, jobId });
  await syncJobStatus(jobId);
  redirect(`${returnPath(fd, jobId)}?logged=1`);
}

export async function updateAttemptAction(attemptId: string, fd: FormData) {
  const user = await requireUser();
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { job: true } });
  if (!canAccessJob(user, a.job) || !(can(user, "manageJobs") || (can(user, "createAttempts") && a.serverId === user.id))) throw new Error("Not allowed");
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { ...attemptData(fd, a.address), ...(can(user, "manageJobs") ? { serverId: await pickServer(user, fd) } : {}) },
  });
  await storeUploads(files(fd, "photos"), "PHOTO", { attemptId, jobId: a.jobId });
  await syncJobStatus(a.jobId);
  redirect(returnPath(fd, a.jobId));
}

export async function deleteAttemptAction(attemptId: string, jobId: string) {
  await requirePerm("deleteAttempts");
  await prisma.attempt.delete({ where: { id: attemptId } });
  await syncJobStatus(jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleAttemptShareAction(attemptId: string, jobId: string) {
  await requirePerm("manageJobs");
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  await prisma.attempt.update({ where: { id: attemptId }, data: { shareWithClient: !a.shareWithClient } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleArchiveAction(id: string) {
  await requirePerm("manageJobs");
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  await prisma.job.update({ where: { id }, data: { archived: !job.archived } });
  revalidatePath(`/jobs/${id}`);
}

/* ---------- clients ---------- */

function clientData(fd: FormData) {
  return {
    name: req(fd, "name"),
    contactName: str(fd, "contactName"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    notes: str(fd, "notes"),
  };
}

export async function saveClientAction(id: string | null, fd: FormData) {
  await requirePerm("manageClients");
  if (id) await prisma.client.update({ where: { id }, data: clientData(fd) });
  else await prisma.client.create({ data: clientData(fd) });
  redirect("/clients");
}

export async function deleteClientAction(id: string) {
  await requirePerm("manageClients");
  await prisma.client.delete({ where: { id } });
  redirect("/clients");
}

/* ---------- employees ---------- */

export async function saveEmployeeAction(id: string | null, _: unknown, fd: FormData) {
  const me = await requirePerm("manageEmployees");
  const existing = id ? await prisma.user.findUniqueOrThrow({ where: { id } }) : null;
  const self = existing?.id === me.id;
  const iAmOwner = me.role === "ADMIN";
  if (existing?.role === "ADMIN" && !iAmOwner) return { error: "Only an Owner can edit another Owner." };

  let role = (str(fd, "role") ?? "SERVER") as Role;
  if (!["ADMIN", "MANAGER", "SERVER", "CONTACT", "CUSTOM"].includes(role)) role = "SERVER";
  if (role === "ADMIN" && !iAmOwner) return { error: "Only an Owner can make someone an Owner." };
  // Nobody can grant permissions they don't have themselves.
  const mine = new Set(effectivePermissions(me));
  let permissions: string[] = role === "CUSTOM" ? fd.getAll("perm").map(String).filter((p): p is Permission => p in PERMISSIONS && mine.has(p as Permission)) : [];
  if (role !== "CUSTOM" && role !== "ADMIN" && ROLE_PRESETS[role].some((p) => !mine.has(p))) return { error: "You can't grant more access than you have." };
  if (self) {
    role = existing!.role;
    permissions = existing!.permissions;
  }

  const firstName = str(fd, "firstName");
  if (!firstName) return { error: "First name is required." };
  if (!str(fd, "email")) return { error: "Email is required." };
  const lastName = str(fd, "lastName") ?? "";
  const day = (v: string | null) => (v ? new Date(`${v}T12:00:00Z`) : null);
  const data = {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: str(fd, "email")!.toLowerCase(),
    phone: str(fd, "phone"),
    dateOfBirth: day(str(fd, "dateOfBirth")),
    licenseNumber: str(fd, "licenseNumber"),
    licenseExpires: day(str(fd, "licenseExpires")),
    timeZone: str(fd, "timeZone"),
    defaultServer: fd.get("defaultServer") === "on",
    addressLine: str(fd, "addressLine"),
    addressUnit: str(fd, "addressUnit"),
    city: str(fd, "city"),
    province: str(fd, "province"),
    postalCode: str(fd, "postalCode"),
    role,
    permissions,
    active: self ? true : fd.get("active") !== null ? fd.get("active") === "on" : true,
  };
  const password = str(fd, "password");
  if (password && password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!existing && !password && role !== "CONTACT") return { error: "Set a password so they can sign in (min. 8 characters). Give it to them; they can change it under My Account." };
  const clash = await prisma.user.findFirst({ where: { email: data.email, NOT: id ? { id } : undefined } });
  if (clash) return { error: "Another employee already uses that email." };

  if (data.defaultServer) await prisma.user.updateMany({ where: { defaultServer: true, NOT: id ? { id } : undefined }, data: { defaultServer: false } });

  let userId = id;
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password), inviteToken: null, inviteExpires: null } : {}) } });
    if (!data.active || role === "CONTACT") await prisma.session.deleteMany({ where: { userId: existing.id } });
  } else {
    const u = await prisma.user.create({ data: { ...data, passwordHash: password ? await hashPassword(password) : null } });
    userId = u.id;
  }
  redirect(`/team/${userId}?saved=1`);
}

/* ---------- settings ---------- */

export async function saveSettingsAction(fd: FormData) {
  await requirePerm("updateSettings");
  const values: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key === "sharePhotosWithClient") values[key] = fd.get(key) === "on" ? "true" : "false";
    else values[key] = (fd.get(key) as string | null)?.trim() ?? "";
  }
  await saveSettings(values);
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

/* ---------- affidavits ---------- */

async function jobForAffidavit(jobId: string) {
  return prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { client: true, server: true, attempts: { include: { server: true } } },
  });
}

export async function saveAffidavitAction(jobId: string, affidavitId: string | null, fd: FormData) {
  const user = await requirePerm("createAffidavits");
  const job = await jobForAffidavit(jobId);
  if (!canAccessJob(user, job)) throw new Error("Not allowed");
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(fd.get("data") ?? "null"));
  } catch {}
  const data = sanitizeAffidavit(raw, defaultAffidavit(job, await getSettings()));
  const pdf = Buffer.from(await renderAffidavit(data));
  const fields = { kind: data.kind, template: data.template, data, pdf };
  let id = affidavitId;
  if (id) {
    const existing = await prisma.affidavit.findUniqueOrThrow({ where: { id } });
    if (existing.jobId !== jobId) throw new Error("Not allowed");
    await prisma.affidavit.update({ where: { id }, data: fields });
  } else {
    id = (await prisma.affidavit.create({ data: { ...fields, jobId, createdById: user.id } })).id;
  }
  redirect(`/jobs/${jobId}/affidavits/${id}?saved=1`);
}

export async function deleteAffidavitAction(id: string) {
  await requirePerm("deleteAffidavits");
  const a = await prisma.affidavit.delete({ where: { id } });
  redirect(`/jobs/${a.jobId}`);
}

/* ---------- client portal (staff side) ---------- */

export async function addPortalUserAction(clientId: string, _: unknown, fd: FormData) {
  await requirePerm("manageClients");
  const name = str(fd, "name");
  if (!name) return { error: "Enter their name." };
  const pinError = checkPin(str(fd, "pin"));
  if (pinError) return { error: pinError };
  const loginName = normalizeLoginName(name);
  if (await prisma.portalUser.findUnique({ where: { loginName } }))
    return { error: `Someone already signs in as "${name}". Add a middle initial or their firm to make it unique.` };
  await prisma.portalUser.create({ data: { clientId, name: name.replace(/\s+/g, " "), loginName, passwordHash: await hashPassword(str(fd, "pin")!) } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: `${name} can now sign in with their name and PIN.` };
}

/** Staff set a new PIN (also unlocks a login that was locked after wrong PINs). */
export async function setPortalPinAction(id: string, _: unknown, fd: FormData) {
  await requirePerm("manageClients");
  const pinError = checkPin(str(fd, "pin"));
  if (pinError) return { error: pinError };
  const u = await prisma.portalUser.update({
    where: { id },
    data: { passwordHash: await hashPassword(str(fd, "pin")!), failedAttempts: 0, lockedUntil: null },
  });
  await prisma.portalSession.deleteMany({ where: { portalUserId: id } });
  revalidatePath(`/clients/${u.clientId}`);
  return { ok: "New PIN saved." };
}

export async function togglePortalUserAction(id: string) {
  await requirePerm("manageClients");
  const u = await prisma.portalUser.findUniqueOrThrow({ where: { id } });
  await prisma.portalUser.update({ where: { id }, data: { active: !u.active } });
  if (u.active) await prisma.portalSession.deleteMany({ where: { portalUserId: id } });
  revalidatePath(`/clients/${u.clientId}`);
}

export async function deletePortalUserAction(id: string) {
  await requirePerm("manageClients");
  const u = await prisma.portalUser.delete({ where: { id } });
  revalidatePath(`/clients/${u.clientId}`);
}

export async function toggleAffidavitClientAction(id: string) {
  await requirePerm("createAffidavits");
  const a = await prisma.affidavit.findUniqueOrThrow({ where: { id } });
  await prisma.affidavit.update({ where: { id }, data: { clientVisible: !a.clientVisible } });
  revalidatePath(`/jobs/${a.jobId}/affidavits/${id}`);
  revalidatePath(`/jobs/${a.jobId}`);
}

/* ---------- my account ---------- */

export async function changePasswordAction(_: unknown, fd: FormData) {
  const me = await requireUser();
  const current = str(fd, "current") ?? "";
  const next = str(fd, "password") ?? "";
  if (!me.passwordHash || !(await verifyPassword(current, me.passwordHash))) return { error: "Your current password is wrong." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== str(fd, "confirm")) return { error: "New passwords don't match." };
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password changed." };
}
