/** Client portal PINs: digits only, 4–8 long. */
export function checkPin(pin: string | null) {
  if (!pin || !/^\d{4,8}$/.test(pin)) return "PIN must be 4 to 8 digits.";
  return null;
}

/** Portal sign-in names are matched case-insensitively with spaces tidied. */
export function normalizeLoginName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export const MAX_PIN_TRIES = 5;
export const LOCK_MINUTES = 15;
