"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function readU16(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readU32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function isSafeZipName(name) {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return false;
  if (/^[a-zA-Z]:/.test(normalized)) return false;
  return true;
}

function findEocd(tail, fileSize, tailStart) {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (readU32(tail, i) !== 0x06054b50) continue;
    const commentLen = readU16(tail, i + 20);
    if (tailStart + i + 22 + commentLen !== fileSize) continue;
    return {
      cdEntries: readU16(tail, i + 10),
      cdSize: readU32(tail, i + 12),
      cdOffset: readU32(tail, i + 16),
    };
  }
  throw new Error("Downloaded zip is not a valid installer archive");
}

function parseCentralDirectory(cd, expectedEntries) {
  const entries = [];
  let offset = 0;
  while (offset + 46 <= cd.length && entries.length < expectedEntries) {
    if (readU32(cd, offset) !== 0x02014b50) break;
    const flags = readU16(cd, offset + 8);
    const method = readU16(cd, offset + 10);
    const crc = readU32(cd, offset + 16);
    const compressedSize = readU32(cd, offset + 20);
    const uncompressedSize = readU32(cd, offset + 24);
    const nameLen = readU16(cd, offset + 28);
    const extraLen = readU16(cd, offset + 30);
    const commentLen = readU16(cd, offset + 32);
    const localOffset = readU32(cd, offset + 42);
    const nameStart = offset + 46;
    const name = cd.subarray(nameStart, nameStart + nameLen).toString("utf8");
    entries.push({
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
      name,
    });
    offset = nameStart + nameLen + extraLen + commentLen;
  }
  return entries;
}

function pickInstallerEntry(entries) {
  const files = entries.filter((entry) => {
    if (!isSafeZipName(entry.name)) return false;
    if (entry.name.endsWith("/")) return false;
    return /\.exe$/i.test(entry.name);
  });
  if (!files.length) return null;
  return (
    files.find((entry) => /setup/i.test(path.posix.basename(entry.name))) ||
    files[0]
  );
}

function extractEntry(fd, entry, destPath) {
  const local = Buffer.alloc(30);
  fs.readSync(fd, local, 0, 30, entry.localOffset);
  if (readU32(local, 0) !== 0x04034b50) {
    throw new Error("Installer zip is corrupted");
  }
  const nameLen = readU16(local, 26);
  const extraLen = readU16(local, 28);
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (entry.method === 0) {
    const out = fs.openSync(destPath, "w");
    try {
      const buf = Buffer.alloc(Math.min(1024 * 1024, entry.compressedSize || 1));
      let remaining = entry.compressedSize;
      let pos = dataStart;
      while (remaining > 0) {
        const n = fs.readSync(fd, buf, 0, Math.min(buf.length, remaining), pos);
        if (n <= 0) throw new Error("Installer zip ended early");
        fs.writeSync(out, buf, 0, n);
        remaining -= n;
        pos += n;
      }
    } finally {
      fs.closeSync(out);
    }
    return;
  }

  if (entry.method === 8) {
    const compressed = Buffer.alloc(entry.compressedSize);
    const n = fs.readSync(fd, compressed, 0, entry.compressedSize, dataStart);
    if (n !== entry.compressedSize) throw new Error("Installer zip ended early");
    const inflated = zlib.inflateRawSync(compressed);
    if (entry.uncompressedSize && inflated.length !== entry.uncompressedSize) {
      throw new Error("Installer zip is corrupted");
    }
    fs.writeFileSync(destPath, inflated);
    return;
  }

  throw new Error("Installer zip uses an unsupported compression method");
}

function extractWindowsInstallerFromZip(zipPath, destExePath) {
  const stat = fs.statSync(zipPath);
  const fd = fs.openSync(zipPath, "r");
  try {
    const tailSize = Math.min(stat.size, 65557);
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);
    const eocd = findEocd(tail, stat.size, stat.size - tailSize);
    if (!eocd.cdSize || eocd.cdOffset + eocd.cdSize > stat.size) {
      throw new Error("Downloaded zip is not a valid installer archive");
    }
    const cd = Buffer.alloc(eocd.cdSize);
    fs.readSync(fd, cd, 0, eocd.cdSize, eocd.cdOffset);
    const entry = pickInstallerEntry(parseCentralDirectory(cd, eocd.cdEntries));
    if (!entry) {
      throw new Error("Zip does not contain a Windows installer");
    }
    extractEntry(fd, entry, destExePath);
  } finally {
    fs.closeSync(fd);
  }
  return destExePath;
}

module.exports = {
  extractWindowsInstallerFromZip,
  isSafeZipName,
  pickInstallerEntry,
};
