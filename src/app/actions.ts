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
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { storeUploads } from "@/lib/files";
import { saveSettings, DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { isServedOutcome, jobNo, OUTCOME_LABEL, fmtDateTime } from "@/lib/labels";
import { appUrl, sendMail } from "@/lib/mail";

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
  redirect(user.role === "ADMIN" ? "/" : "/field");
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
  await requireAdmin();
  const job = await prisma.job.create({
    data: { ...jobData(fd), trackingToken: randomBytes(18).toString("base64url") },
  });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: job.id });
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(id: string, fd: FormData) {
  await requireAdmin();
  await prisma.job.update({ where: { id }, data: jobData(fd) });
  await storeUploads(files(fd, "documents"), "DOCUMENT", { jobId: id });
  redirect(`/jobs/${id}`);
}

export async function setJobStatusAction(id: string, fd: FormData) {
  await requireAdmin();
  const status = req(fd, "status") as JobStatus;
  await prisma.job.update({
    where: { id },
    data: { status, servedAt: status === "SERVED" ? new Date() : undefined },
  });
  revalidatePath(`/jobs/${id}`);
}

export async function assignServerAction(id: string, fd: FormData) {
  await requireAdmin();
  await prisma.job.update({ where: { id }, data: { serverId: str(fd, "serverId") } });
  revalidatePath(`/jobs/${id}`);
}

export async function toggleTrackingAction(id: string) {
  await requireAdmin();
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  await prisma.job.update({ where: { id }, data: { trackingEnabled: !job.trackingEnabled } });
  revalidatePath(`/jobs/${id}`);
}

export async function regenerateTrackingAction(id: string) {
  await requireAdmin();
  await prisma.job.update({ where: { id }, data: { trackingToken: randomBytes(18).toString("base64url") } });
  revalidatePath(`/jobs/${id}`);
}

export async function deleteJobAction(id: string) {
  await requireAdmin();
  await prisma.job.delete({ where: { id } });
  redirect("/jobs");
}

export async function deleteFileAction(fileId: string, jobId: string) {
  await requireAdmin();
  await prisma.file.delete({ where: { id: fileId } });
  revalidatePath(`/jobs/${jobId}`);
}

/* ---------- attempts ---------- */

export async function createAttemptAction(jobId: string, fd: FormData) {
  const user = await requireUser();
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { client: true } });
  if (!canAccessJob(user, job)) throw new Error("Not allowed");

  const outcome = req(fd, "outcome") as AttemptOutcome;
  const num = (k: string) => {
    const v = str(fd, k);
    return v && !Number.isNaN(Number(v)) ? Number(v) : null;
  };
  const when = str(fd, "attemptedAt");

  const attempt = await prisma.attempt.create({
    data: {
      jobId,
      serverId: user.id,
      attemptedAt: when ? new Date(when) : new Date(),
      address: str(fd, "address") ?? job.address,
      outcome,
      personServed: str(fd, "personServed"),
      relationship: str(fd, "relationship"),
      personDescription: str(fd, "personDescription"),
      identifiedBy: str(fd, "identifiedBy"),
      notes: str(fd, "notes"),
      latitude: num("latitude"),
      longitude: num("longitude"),
      gpsAccuracy: num("gpsAccuracy"),
      shareWithClient: fd.get("shareWithClient") === "on",
    },
  });
  await storeUploads(files(fd, "photos"), "PHOTO", { attemptId: attempt.id, jobId });

  const served = isServedOutcome(outcome);
  await prisma.job.update({
    where: { id: jobId },
    data: served
      ? { status: "SERVED", servedAt: attempt.attemptedAt }
      : job.status === "PENDING"
        ? { status: "IN_PROGRESS" }
        : {},
  });

  if (attempt.shareWithClient && job.trackingEnabled) {
    const to = [job.notifyEmails, job.client?.email]
      .filter(Boolean)
      .join(",")
      .split(/[,;\s]+/)
      .filter((e) => e.includes("@"));
    const ref = job.clientReference ? ` (your ref. ${job.clientReference})` : "";
    await sendMail(
      [...new Set(to)],
      `${served ? "Served" : "Attempt update"}: ${job.recipientName} – ${jobNo(job.number)}`,
      `Service update for ${job.recipientName}${ref}\n\n` +
        `${fmtDateTime(attempt.attemptedAt)}\n${OUTCOME_LABEL[outcome]}\n${attempt.address}\n` +
        `${attempt.notes ? `\nNotes: ${attempt.notes}\n` : ""}` +
        `\nLive tracking: ${appUrl()}/track/${job.trackingToken}\n`
    );
  }

  redirect(user.role === "ADMIN" ? `/jobs/${jobId}` : `/field/${jobId}?logged=1`);
}

export async function deleteAttemptAction(attemptId: string, jobId: string) {
  await requireAdmin();
  await prisma.attempt.delete({ where: { id: attemptId } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleAttemptShareAction(attemptId: string, jobId: string) {
  await requireAdmin();
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  await prisma.attempt.update({ where: { id: attemptId }, data: { shareWithClient: !a.shareWithClient } });
  revalidatePath(`/jobs/${jobId}`);
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
  await requireAdmin();
  if (id) await prisma.client.update({ where: { id }, data: clientData(fd) });
  else await prisma.client.create({ data: clientData(fd) });
  redirect("/clients");
}

export async function deleteClientAction(id: string) {
  await requireAdmin();
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
