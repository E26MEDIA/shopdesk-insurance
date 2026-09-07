const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const mainPath = path.join(__dirname, "..", "electron", "main.cjs");
const main = fs.readFileSync(mainPath, "utf8");

let failed = false;

if (!main.includes("spawnNodeScript")) {
  console.error("FAIL: electron/main.cjs must start the offline UI via spawnNodeScript");
  failed = true;
}

if (main.includes("sandbox: false")) {
  console.error("FAIL: renderer windows must stay sandboxed");
  failed = true;
}

const exePath = path.join(
  __dirname,
  "..",
  "dist-desktop",
  `ShopDesk-Setup-${pkg.version}.exe`,
);
if (fs.existsSync(exePath)) {
  const sizeMb = fs.statSync(exePath).size / (1024 * 1024);
  if (sizeMb < 50) {
    console.error(`FAIL: installer too small (${sizeMb.toFixed(1)} MB) — likely broken build`);
    failed = true;
  } else {
    console.log(`OK: installer size ${sizeMb.toFixed(1)} MB`);
  }
  const zipPath = exePath.replace(/\.exe$/i, ".zip");
  if (!fs.existsSync(zipPath)) {
    console.error(`FAIL: missing ${path.basename(zipPath)}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("OK: desktop package checks passed");
