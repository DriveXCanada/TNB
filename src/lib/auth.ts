import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { User } from "@prisma/client";

const COOKIE = "tnb_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Master account only: team, settings. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(isStaff(user) ? "/" : "/jobs");
  return user;
}

/** Master account or managers: can see and manage every job and client. */
export async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/jobs");
  return user;
}

export function isStaff(user: Pick<User, "role">) {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/** Servers may only see jobs assigned to them; the master account and managers see every job. */
export function canAccessJob(user: User, job: { serverId: string | null }) {
  return isStaff(user) || job.serverId === user.id;
}

export const ROLE_LABEL = { ADMIN: "Master", MANAGER: "Manager", SERVER: "Process server" } as const;
