const fs = require("fs");
const path = require("path");

const mainPath = path.join(__dirname, "..", "electron", "main.cjs");
const main = fs.readFileSync(mainPath, "utf8");

let failed = false;

if (!main.includes('require("child_process")') && !main.includes("require('child_process')")) {
  console.error("FAIL: electron/main.cjs must import child_process");
  failed = true;
}

if (main.includes("spawn(") && !main.includes("spawn")) {
  console.error("FAIL: spawn used but may not be imported");
  failed = true;
}

if (!main.includes("const { spawn }") && main.includes("spawn(process.execPath")) {
  console.error("FAIL: spawn is not destructured from child_process");
  failed = true;
}

const exePath = path.join(__dirname, "..", "dist-desktop", "ShopDesk-Setup-0.1.0.exe");
if (fs.existsSync(exePath)) {
  const sizeMb = fs.statSync(exePath).size / (1024 * 1024);
  if (sizeMb < 50) {
    console.error(`FAIL: installer too small (${sizeMb.toFixed(1)} MB) — likely broken build`);
    failed = true;
  } else {
    console.log(`OK: installer size ${sizeMb.toFixed(1)} MB`);
  }
}

if (failed) process.exit(1);
console.log("OK: desktop package checks passed");
