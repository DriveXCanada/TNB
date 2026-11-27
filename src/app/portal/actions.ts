"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createPortalSession, destroyPortalSession, requirePortalUser } from "@/lib/portalAuth";
import { checkPin, LOCK_MINUTES, MAX_PIN_TRIES, normalizeLoginName } from "@/lib/pin";

const WRONG = { error: "That name and PIN don't match." };

export async function portalLoginAction(_: unknown, fd: FormData) {
  const loginName = normalizeLoginName(String(fd.get("name") ?? ""));
  const pin = String(fd.get("pin") ?? "");
  const u = loginName ? await prisma.portalUser.findUnique({ where: { loginName } }) : null;
  if (!u || !u.active || !u.passwordHash) return WRONG;

  // Lock the login for a while after too many wrong PINs, so short PINs can't be guessed.
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    return { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes, or contact us to reset your PIN.` };
  }
  if (!(await verifyPassword(pin, u.passwordHash))) {
    const tries = u.failedAttempts + 1;
    const lock = tries >= MAX_PIN_TRIES;
    await prisma.portalUser.update({
      where: { id: u.id },
      data: lock ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } : { failedAttempts: tries },
    });
    if (lock) return { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes, or contact us to reset your PIN.` };
    return WRONG;
  }
  await prisma.portalUser.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null } });
  await createPortalSession(u.id);
  redirect("/portal");
}

export async function portalLogoutAction() {
  await destroyPortalSession();
  redirect("/portal/login");
}

export async function changePinAction(_: unknown, fd: FormData) {
  const me = await requirePortalUser();
  const u = await prisma.portalUser.findUniqueOrThrow({ where: { id: me.id } });
  if (!u.passwordHash || !(await verifyPassword(String(fd.get("current") ?? ""), u.passwordHash))) {
    return { error: "Your current PIN is wrong." };
  }
  const pin = String(fd.get("password") ?? "");
  const bad = checkPin(pin);
  if (bad) return { error: bad };
  if (pin !== String(fd.get("confirm") ?? "")) return { error: "The new PINs don't match." };
  await prisma.portalUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pin) } });
  return { ok: "Your PIN has been changed." };
}
