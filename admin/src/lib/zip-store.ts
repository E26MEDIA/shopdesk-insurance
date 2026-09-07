const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32Update(data: Uint8Array, previous = 0xffffffff): number {
  let crc = previous;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

export function crc32Finish(crc: number) {
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

/**
 * Build an uncompressed (stored) zip containing one file.
 * Chrome will download a .zip without the .exe "Virus detected" block.
 */
export function createStoredZip(fileName: string, parts: Uint8Array[]): Blob {
  let size = 0;
  let crc = 0xffffffff;
  for (const part of parts) {
    crc = crc32Update(part, crc);
    size += part.length;
  }
  crc = crc32Finish(crc);

  const nameBytes = new TextEncoder().encode(fileName);
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

  const zipParts: BlobPart[] = [
    localHeader.slice(),
    ...parts.map((part) => part.slice()),
    centralHeader.slice(),
    eocd.slice(),
  ];
  return new Blob(zipParts, {
    type: "application/zip",
  });
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
