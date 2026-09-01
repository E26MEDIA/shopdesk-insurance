import { prisma } from "./db";

const DEFAULT_OFFLINE_GRACE_DAYS = 30;

export async function getOfflineGraceDays(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "offline_grace_days" },
  });
  if (!row) return DEFAULT_OFFLINE_GRACE_DAYS;
  const n = Number(row.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_OFFLINE_GRACE_DAYS;
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isLicenseExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  return expiryDate.getTime() < Date.now();
}

export async function getProductModules(
  productId: string,
  edition?: string,
): Promise<string[]> {
  const rows = await prisma.productModule.findMany({
    where: { productId, module: { status: "ACTIVE" } },
    include: { module: true },
  });
  const keys = rows.map((r) => r.module.moduleKey);

  const EDITION_MODULES: Record<string, string[]> = {
    Basic: ["customers", "vehicles", "insurance", "income", "expenses"],
    Professional: [
      "customers",
      "vehicles",
      "insurance",
      "income",
      "expenses",
      "puc",
      "renewals",
      "reports",
      "reminders",
    ],
    Business: keys,
  };

  if (!edition || !EDITION_MODULES[edition]) return keys;
  return keys.filter((k) => EDITION_MODULES[edition].includes(k));
}
