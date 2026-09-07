const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { zipSingleFile } = require("./zip-stored-file.cjs");
const afterAllArtifactBuild = require("./after-all-artifact-build.cjs");

test("zipSingleFile wraps one exe in a PK zip", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-storezip-"));
  const exePath = path.join(dir, "ShopDesk-Setup-0.1.1.exe");
  const zipPath = path.join(dir, "ShopDesk-Setup-0.1.1.exe.zip");
  try {
    fs.writeFileSync(exePath, Buffer.from("MZ-installer"));
    zipSingleFile(exePath, zipPath, "ShopDesk-Setup-0.1.1.exe");
    const bytes = fs.readFileSync(zipPath);
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    assert.ok(bytes.includes(Buffer.from("ShopDesk-Setup-0.1.1.exe")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("afterAllArtifactBuild zips NSIS setup artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-artifacts-"));
  const exePath = path.join(dir, "ShopDesk-Setup-0.1.1.exe");
  try {
    fs.writeFileSync(exePath, Buffer.from("MZ-installer"));
    const extra = afterAllArtifactBuild({ artifactPaths: [exePath] });
    const zipPath = exePath.replace(/\.exe$/i, ".zip");
    assert.deepEqual(extra, [zipPath]);
    assert.equal(fs.existsSync(zipPath), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
