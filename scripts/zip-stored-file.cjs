"use strict";

const fs = require("fs");
const path = require("path");

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32Update(data, previous = 0xffffffff) {
  let crc = previous;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

function crc32Finish(crc) {
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32File(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    let crc = 0xffffffff;
    const buf = Buffer.alloc(1024 * 1024);
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      crc = crc32Update(buf.subarray(0, n), crc);
    }
    return crc32Finish(crc);
  } finally {
    fs.closeSync(fd);
  }
}

function u16(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value >>> 0, 0);
  return buf;
}

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

function concat(chunks) {
  return Buffer.concat(chunks);
}

/**
 * Write an uncompressed (stored) zip with one file. Used so Chrome/Dropbox
 * can host ShopDesk-Setup-*.exe.zip instead of a raw .exe.
 */
function zipSingleFile(srcPath, zipPath, innerName) {
  const stat = fs.statSync(srcPath);
  const size = stat.size;
  if (size > 0xfffffffe) {
    throw new Error("File is too large for a standard zip");
  }
  const crc = crc32File(srcPath);
  const nameBytes = Buffer.from(String(innerName || path.basename(srcPath)), "utf8");
  const localHeader = concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
  ]);
  const centralHeader = concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    nameBytes,
  ]);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(centralHeader.length),
    u32(localHeader.length + size),
    u16(0),
  ]);

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const out = fs.openSync(zipPath, "w");
  try {
    let offset = 0;
    const write = (buf) => {
      fs.writeSync(out, buf, 0, buf.length, offset);
      offset += buf.length;
    };
    write(localHeader);
    const src = fs.openSync(srcPath, "r");
    try {
      const buf = Buffer.alloc(1024 * 1024);
      for (;;) {
        const n = fs.readSync(src, buf, 0, buf.length, null);
        if (n <= 0) break;
        fs.writeSync(out, buf, 0, n, offset);
        offset += n;
      }
    } finally {
      fs.closeSync(src);
    }
    write(centralHeader);
    write(eocd);
  } finally {
    fs.closeSync(out);
  }
  return zipPath;
}

module.exports = {
  crc32Update,
  crc32Finish,
  crc32File,
  zipSingleFile,
};
