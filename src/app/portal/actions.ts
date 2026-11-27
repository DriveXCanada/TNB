"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createPortalSession, destroyPortalSession } from "@/lib/portalAuth";

export async function portalLoginAction(_: unknown, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const u = await prisma.portalUser.findUnique({ where: { email } });
  if (!u || !u.active || !u.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createPortalSession(u.id);
  redirect("/portal");
}

export async function portalLogoutAction() {
  await destroyPortalSession();
  redirect("/portal/login");
}

export async function acceptPortalInviteAction(token: string, _: unknown, fd: FormData) {
  const u = await prisma.portalUser.findUnique({ where: { inviteToken: token } });
  if (!u || !u.inviteExpires || u.inviteExpires < new Date() || !u.active) {
    return { error: "This link has expired. Ask us to send a new one." };
  }
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Passwords don't match." };
  await prisma.portalUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password), inviteToken: null, inviteExpires: null } });
  await createPortalSession(u.id);
  redirect("/portal");
}
