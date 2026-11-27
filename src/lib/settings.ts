import { prisma } from "./db";

export const DEFAULT_SETTINGS = {
  companyName: "Vantage Security Consulting",
  tagline: "See every angle. Cover every risk.",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
  province: "Nova Scotia",
  defaultCourt: "Supreme Court of Nova Scotia",
  oathPhrase: "make oath and give evidence as follows",
  commissionerTitle: "Signature of authority",
  affidavitFooter: "",
  affidavitStatement:
    "I, {name}, being duly sworn, depose and say: I am over the age of 18 years and not a party to this action, and that within the boundaries of the Province where service was effected, I was authorized by law to make service of the documents and informed said person of the contents herein.",
  notaryText: "Identity of signatory verified by government issued photo identification",
  sharePhotosWithClient: "false",
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) (out as Record<string, string>)[r.key] = r.value;
  return out;
}

export async function saveSettings(values: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } })
    )
  );
}
