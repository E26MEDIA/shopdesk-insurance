/**
 * Upload Windows installer to Vercel Blob (fast public CDN).
 * Usage: BLOB_READ_WRITE_TOKEN=xxx node scripts/upload-installer-blob.mjs
 */
import { readFileSync } from "fs";
import { put } from "@vercel/blob";

const filePath = "dist-desktop/ShopDesk-Setup-0.1.0.exe";
const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const data = readFileSync(filePath);
const blob = await put("ShopDesk-Setup-0.1.0.exe", data, {
  access: "public",
  token,
  addRandomSuffix: false,
  contentType: "application/x-msdownload",
});

console.log("\n--- Fast download URL (paste in Admin → Download) ---");
console.log(blob.url);
console.log("----------------------------------------------------\n");
