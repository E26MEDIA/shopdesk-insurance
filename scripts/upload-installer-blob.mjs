/**
 * Upload Windows installer zip to Vercel Blob (fast public CDN).
 * Usage: BLOB_READ_WRITE_TOKEN=xxx node scripts/upload-installer-blob.mjs
 */
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import { put } from "@vercel/blob";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const exeName = `ShopDesk-Setup-${version}.exe`;
const zipName = exeName.replace(/\.exe$/i, ".zip");
const zipPath = `dist-desktop/${zipName}`;
const exePath = `dist-desktop/${exeName}`;
const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const filePath = existsSync(zipPath) ? zipPath : exePath;
const blobName = existsSync(zipPath) ? zipName : exeName;
const contentType = existsSync(zipPath)
  ? "application/zip"
  : "application/x-msdownload";

const data = readFileSync(filePath);
const blob = await put(blobName, data, {
  access: "public",
  token,
  addRandomSuffix: false,
  contentType,
});

console.log("\n--- Fast download URL (paste in Admin → Software) ---");
console.log(blob.url);
console.log("----------------------------------------------------\n");
