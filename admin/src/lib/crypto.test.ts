import { describe, expect, it } from "vitest";
import {
  generateLicenseKey,
  hashLicenseKey,
  normalizeLicenseKey,
} from "@/lib/crypto";

describe("license key crypto", () => {
  it("generates E26-INS format keys", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^E26-INS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("normalizes license keys", () => {
    expect(normalizeLicenseKey(" e26-ins-abcd-efgh-ijkl ")).toBe(
      "E26-INS-ABCD-EFGH-IJKL",
    );
  });

  it("hashes consistently", () => {
    const a = hashLicenseKey("E26-INS-TEST-1234-5678");
    const b = hashLicenseKey("e26-ins-test-1234-5678");
    expect(a).toBe(b);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateLicenseKey()));
    expect(keys.size).toBe(20);
  });
});
