import { prisma } from "./db";

export const DEFAULT_SETTINGS = {
  companyName: "My Process Serving Co.",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
  province: "Nova Scotia",
  defaultCourt: "Supreme Court of Nova Scotia",
  oathPhrase: "make oath and give evidence as follows",
  commissionerTitle: "Signature of authority",
  affidavitFooter: "",
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
