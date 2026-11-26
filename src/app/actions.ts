"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import type { AttemptOutcome, JobStatus, Priority, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canAccessJob,
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  requireStaff,
  isStaff,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { storeUploads } from "@/lib/files";
import { saveSettings, DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { isServedOutcome, jobNo, OUTCOME_LABEL, fmtDateTime } from "@/lib/labels";
import { appUrl, sendMail } from "@/lib/mail";
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
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect(isStaff(user) ? "/" : "/jobs");
}

export async function setupAction(_: unknown, fd: FormData) {
  if ((await prisma.user.count()) > 0) redirect("/login");
  const password = req(fd, "password");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const user = await prisma.user.create({
    data: {
      name: req(fd, "name"),
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
    notifyEmails: str(fd, "notifyEmails"),
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
  const me = await requireStaff();
  const job = await prisma.job.create({
    data: { ...jobData(fd), createdById: me.id, trackingToken: randomBytes(18).toString("base64url") },
  });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: job.id });
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(id: string, fd: FormData) {
  await requireStaff();
  await prisma.job.update({ where: { id }, data: jobData(fd) });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: id });
  redirect(`/jobs/${id}`);
}

export async function setJobStatusAction(id: string, fd: FormData) {
  await requireStaff();
  const status = req(fd, "status") as JobStatus;
  await prisma.job.update({
    where: { id },
    data: { status, servedAt: status === "SERVED" ? new Date() : undefined },
  });
  revalidatePath(`/jobs/${id}`);
}

export async function assignServerAction(id: string, fd: FormData) {
  await requireStaff();
  await prisma.job.update({ where: { id }, data: { serverId: str(fd, "serverId") } });
  revalidatePath(`/jobs/${id}`);
}

export async function toggleTrackingAction(id: string) {
  await requireStaff();
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  await prisma.job.update({ where: { id }, data: { trackingEnabled: !job.trackingEnabled } });
  revalidatePath(`/jobs/${id}`);
}

export async function regenerateTrackingAction(id: string) {
  await requireStaff();
  await prisma.job.update({ where: { id }, data: { trackingToken: randomBytes(18).toString("base64url") } });
  revalidatePath(`/jobs/${id}`);
}

export async function deleteJobAction(id: string) {
  await requireStaff();
  await prisma.job.delete({ where: { id } });
  redirect("/jobs");
}

export async function deleteFileAction(fileId: string, jobId: string) {
  await requireStaff();
  await prisma.file.delete({ where: { id: fileId } });
  revalidatePath(`/jobs/${jobId}`);
}

/* ---------- attempts ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checked recipients plus anything typed in "other email", de-duplicated and validated. */
function chosenRecipients(fd: FormData) {
  const typed = (str(fd, "emailOther") ?? "").split(/[,;\s]+/);
  const picked = fd.getAll("emailTo").map(String);
  return [...new Set([...picked, ...typed].map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
}

async function emailAttempt(attemptId: string, to: string[]) {
  if (to.length === 0) return;
  const a = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { server: true, files: true, job: true },
  });
  const job = a.job;
  const served = isServedOutcome(a.outcome);
  const lines = [
    `Service update for ${job.recipientName}`,
    job.clientReference ? `Your job no.: ${job.clientReference}` : "",
    job.courtFileNumber ? `Court case no.: ${job.courtFileNumber}` : "",
    "",
    `${OUTCOME_LABEL[a.outcome]}`,
    `${fmtDateTime(a.attemptedAt)}`,
    `${a.address}`,
    a.server ? `Server: ${a.server.name}` : "",
    a.personServed ? `Person served: ${a.personServed}${a.relationship ? ` (${a.relationship})` : ""}` : "",
    a.personDescription ? `Description: ${a.personDescription}` : "",
    a.latitude != null && a.longitude != null ? `GPS: https://www.google.com/maps?q=${a.latitude},${a.longitude}` : "",
    a.notes ? `\nNotes: ${a.notes}` : "",
    job.trackingEnabled && a.shareWithClient ? `\nLive tracking: ${appUrl()}/track/${job.trackingToken}` : "",
  ];
  await sendMail(
    to,
    `${served ? "Served" : "Attempt"}: ${job.recipientName} – ${jobNo(job.number)}`,
    lines.filter((l, i) => l !== "" || i === 3).join("\n"),
    a.files.filter((f) => f.kind === "PHOTO").map((f) => ({ filename: f.filename, content: Buffer.from(f.data), contentType: f.mimeType }))
  );
}

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
async function pickServer(user: { id: string; role: string }, fd: FormData) {
  const chosen = str(fd, "serverId");
  if (!chosen || !isStaff(user as never) || chosen === user.id) return user.id;
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
  const user = await requireUser();
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
  await emailAttempt(attempt.id, chosenRecipients(fd));
  redirect(`${returnPath(fd, jobId)}?logged=1`);
}

export async function updateAttemptAction(attemptId: string, fd: FormData) {
  const user = await requireUser();
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { job: true } });
  if (!canAccessJob(user, a.job) || (!isStaff(user) && a.serverId !== user.id)) throw new Error("Not allowed");
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { ...attemptData(fd, a.address), ...(isStaff(user) ? { serverId: await pickServer(user, fd) } : {}) },
  });
  await storeUploads(files(fd, "photos"), "PHOTO", { attemptId, jobId: a.jobId });
  await syncJobStatus(a.jobId);
  await emailAttempt(attemptId, chosenRecipients(fd));
  redirect(returnPath(fd, a.jobId));
}

/** "Share" on an existing attempt: email it to the chosen recipients. */
export async function emailAttemptAction(attemptId: string, fd: FormData) {
  const user = await requireUser();
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { job: true } });
  if (!canAccessJob(user, a.job)) throw new Error("Not allowed");
  const to = chosenRecipients(fd);
  await emailAttempt(attemptId, to);
  redirect(`/jobs/${a.jobId}?emailed=${to.length}`);
}

export async function deleteAttemptAction(attemptId: string, jobId: string) {
  await requireStaff();
  await prisma.attempt.delete({ where: { id: attemptId } });
  await syncJobStatus(jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleAttemptShareAction(attemptId: string, jobId: string) {
  await requireStaff();
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  await prisma.attempt.update({ where: { id: attemptId }, data: { shareWithClient: !a.shareWithClient } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleArchiveAction(id: string) {
  await requireStaff();
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
  await requireStaff();
  if (id) await prisma.client.update({ where: { id }, data: clientData(fd) });
  else await prisma.client.create({ data: clientData(fd) });
  redirect("/clients");
}

export async function deleteClientAction(id: string) {
  await requireStaff();
  await prisma.client.delete({ where: { id } });
  redirect("/clients");
}

/* ---------- team ---------- */

export async function saveUserAction(id: string | null, fd: FormData) {
  const me = await requireAdmin();
  const password = str(fd, "password");
  const base = {
    name: req(fd, "name"),
    email: req(fd, "email").toLowerCase(),
    phone: str(fd, "phone"),
    city: str(fd, "city"),
    role: (str(fd, "role") ?? "SERVER") as Role,
    active: id === me.id ? true : fd.get("active") === "on",
  };
  if (id === me.id) base.role = "ADMIN";
  if (password && password.length < 8) throw new Error("Password must be at least 8 characters");
  if (id) {
    await prisma.user.update({
      where: { id },
      data: { ...base, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    });
    if (!base.active) await prisma.session.deleteMany({ where: { userId: id } });
  } else {
    if (!password) throw new Error("Password is required for new users");
    await prisma.user.create({ data: { ...base, passwordHash: await hashPassword(password) } });
  }
  redirect("/team");
}

/* ---------- settings ---------- */

export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
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
  const user = await requireUser();
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
  redirect(fd.get("intent") === "share" ? `/jobs/${jobId}/affidavits/${id}/share` : `/jobs/${jobId}/affidavits/${id}?saved=1`);
}

export async function deleteAffidavitAction(id: string) {
  await requireStaff();
  const a = await prisma.affidavit.delete({ where: { id } });
  redirect(`/jobs/${a.jobId}`);
}

export async function emailAffidavitAction(id: string, fd: FormData) {
  const user = await requireUser();
  const a = await prisma.affidavit.findUniqueOrThrow({ where: { id }, include: { job: true } });
  if (!canAccessJob(user, a.job)) throw new Error("Not allowed");
  const to = chosenRecipients(fd);
  const title = a.kind === "SERVICE" ? "Affidavit of Service" : "Affidavit of Non-Service";
  const message = str(fd, "message");
  await sendMail(
    to,
    `${title}: ${a.job.recipientName} – ${jobNo(a.job.number)}`,
    `${message ? `${message}\n\n` : ""}Please find attached the ${title.toLowerCase()} for ${a.job.recipientName}` +
      `${a.job.clientReference ? ` (your job no. ${a.job.clientReference})` : ""}${a.job.courtFileNumber ? `, court case ${a.job.courtFileNumber}` : ""}.\n`,
    [{ filename: `${title.replace(/ /g, "-")}-${jobNo(a.job.number)}.pdf`, content: Buffer.from(a.pdf), contentType: "application/pdf" }]
  );
  redirect(`/jobs/${a.jobId}/affidavits/${id}?emailed=${to.length}`);
}
