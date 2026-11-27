import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "./db";

/** Client portal sessions use their own cookie and table, never the employee ones. */
const COOKIE = "vsc_portal";
const DAYS = 30;

export async function createPortalSession(portalUserId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 86400000);
  await prisma.portalSession.create({ data: { id, portalUserId, expiresAt } });
  await prisma.portalUser.update({ where: { id: portalUserId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPortalSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.portalSession.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export async function getPortalUser() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = await prisma.portalSession.findUnique({ where: { id }, include: { portalUser: { include: { client: true } } } });
  if (!s || s.expiresAt < new Date() || !s.portalUser.active) return null;
  return s.portalUser;
}

export async function requirePortalUser() {
  const u = await getPortalUser();
  if (!u) redirect("/portal/login");
  return u;
}
