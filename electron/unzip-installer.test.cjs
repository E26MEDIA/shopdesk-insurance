const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { zipSingleFile } = require("../scripts/zip-stored-file.cjs");
const {
  extractWindowsInstallerFromZip,
  isSafeZipName,
  pickInstallerEntry,
} = require("./unzip-installer.cjs");

function fakeExe(label = "ShopDesk installer") {
  const buf = Buffer.alloc(128, 0);
  buf[0] = 0x4d;
  buf[1] = 0x5a;
  buf.write(label, 4);
  return buf;
}

test("isSafeZipName blocks path traversal", () => {
  assert.equal(isSafeZipName("ShopDesk-Setup-0.1.1.exe"), true);
  assert.equal(isSafeZipName("../evil.exe"), false);
  assert.equal(isSafeZipName("folder/../../Windows/evil.exe"), false);
});

test("pickInstallerEntry prefers a Setup exe", () => {
  const chosen = pickInstallerEntry([
    { name: "readme.txt" },
    { name: "helper.exe" },
    { name: "ShopDesk-Setup-0.1.1.exe" },
  ]);
  assert.equal(chosen.name, "ShopDesk-Setup-0.1.1.exe");
});

test("extractWindowsInstallerFromZip unwraps a stored setup exe", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-zip-"));
  const exePath = path.join(dir, "ShopDesk-Setup-0.1.1.exe");
  const zipPath = path.join(dir, "ShopDesk-Setup-0.1.1.exe.zip");
  const outPath = path.join(dir, "out.exe");
  try {
    fs.writeFileSync(exePath, fakeExe());
    zipSingleFile(exePath, zipPath, "ShopDesk-Setup-0.1.1.exe");
    extractWindowsInstallerFromZip(zipPath, outPath);
    assert.equal(fs.readFileSync(outPath).compare(fakeExe()), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("extractWindowsInstallerFromZip unwraps a deflated setup exe", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-zipd-"));
  const zipPath = path.join(dir, "setup.zip");
  const outPath = path.join(dir, "out.exe");
  try {
    const payload = fakeExe("deflated");
    const compressed = zlib.deflateRawSync(payload);
    const name = Buffer.from("InsuranceDesk-Setup.exe");
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    name.copy(central, 46);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(local.length + compressed.length, 16);
    fs.writeFileSync(zipPath, Buffer.concat([local, compressed, central, eocd]));
    extractWindowsInstallerFromZip(zipPath, outPath);
    assert.equal(fs.readFileSync(outPath).compare(payload), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
