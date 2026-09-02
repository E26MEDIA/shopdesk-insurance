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

if (!main.includes("activation.html")) {
  console.error("FAIL: electron/main.cjs must load the verification key page");
  failed = true;
}

if (!main.includes("consumePendingKey")) {
  console.error("FAIL: electron/main.cjs must consume the installer verification key");
  failed = true;
}

const nshPath = path.join(__dirname, "..", "resources", "installer.nsh");
if (!fs.existsSync(nshPath)) {
  console.error("FAIL: resources/installer.nsh is missing");
  failed = true;
} else {
  const nsh = fs.readFileSync(nshPath, "utf8");
  if (!nsh.includes("VerificationKeyPage") || !nsh.includes("customPageAfterChangeDir") || !nsh.includes("BUILD_UNINSTALLER")) {
    console.error("FAIL: installer.nsh must show a verification key page on the installer only");
    failed = true;
  }
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);
if (packageJson.build?.nsis?.oneClick !== false) {
  console.error("FAIL: NSIS oneClick must be false so the verification key page is shown");
  failed = true;
}
if (packageJson.build?.nsis?.allowToChangeInstallationDirectory !== true) {
  console.error("FAIL: NSIS must allow the directory page so the verification key page is inserted");
  failed = true;
}
if (!String(packageJson.build?.nsis?.include || "").includes("installer.nsh")) {
  console.error("FAIL: NSIS include must point at the verification key installer script");
  failed = true;
}

const activationHtml = path.join(__dirname, "..", "electron", "licensing", "activation.html");
if (!fs.existsSync(activationHtml)) {
  console.error("FAIL: electron/licensing/activation.html is missing");
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
