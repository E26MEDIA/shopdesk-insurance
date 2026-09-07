import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStoredZip, crc32Finish, crc32Update } from "@/lib/zip-store";

describe("createStoredZip", () => {
  it("computes the IEEE CRC-32 of 123456789", () => {
    const crc = crc32Finish(crc32Update(new TextEncoder().encode("123456789")));
    expect(crc).toBe(0xcbf43926);
  });

  it("makes a zip Python can extract", async () => {
    const payload = new TextEncoder().encode("ShopDesk installer bytes");
    const blob = createStoredZip("ShopDesk-Setup-0.1.0.exe", [payload]);
    const dir = mkdtempSync(join(tmpdir(), "zip-store-"));
    const zipPath = join(dir, "setup.zip");
    writeFileSync(zipPath, Buffer.from(await blob.arrayBuffer()));

    const listed = spawnSync("python3", ["-c", `import zipfile; z=zipfile.ZipFile(${JSON.stringify(zipPath)}); print(z.namelist()[0]); print(z.read(z.namelist()[0]).decode())`], {
      encoding: "utf8",
    });
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("ShopDesk-Setup-0.1.0.exe");
    expect(listed.stdout).toContain("ShopDesk installer bytes");
    expect(readFileSync(zipPath).length).toBeGreaterThan(payload.length);
  });
});
