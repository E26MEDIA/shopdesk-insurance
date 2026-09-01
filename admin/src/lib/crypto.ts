import { createHash, randomBytes } from "crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(normalizeLicenseKey(key)).digest("hex");
}

export function hashFingerprint(fp: string): string {
  return createHash("sha256").update(fp.trim()).digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

/** E26-INS-XXXX-XXXX-XXXX */
export function generateLicenseKey(): string {
  return `E26-INS-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

export function generateShopCode(): string {
  return `SHOP-${randomSegment(4)}${randomSegment(2)}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateLicenseDisplayId(): string {
  return `LIC-${Date.now().toString(36).toUpperCase()}-${randomSegment(4)}`;
}
