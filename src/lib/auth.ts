import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { User } from "@prisma/client";
import { can, type Permission } from "./permissions";

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
  if (!session || session.expiresAt < new Date() || !session.user.active || session.user.role === "CONTACT") return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirect away unless the user has this permission. */
export async function requirePerm(perm: Permission) {
  const user = await requireUser();
  if (!can(user, perm)) redirect(can(user, "viewDashboard") ? "/" : "/jobs");
  return user;
}

/** Users who can see every job (Owner, Admin, or Custom with "View Everyone's Jobs"). */
export function isStaff(user: Pick<User, "role" | "permissions">) {
  return can(user, "viewAllJobs");
}

/** Servers may only see jobs assigned to them unless they can view everyone's jobs. */
export function canAccessJob(user: User, job: { serverId: string | null }) {
  return can(user, "viewAllJobs") || job.serverId === user.id;
}

export { can };
