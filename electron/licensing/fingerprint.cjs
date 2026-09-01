const { createHash } = require("crypto");
const os = require("os");
const { execSync } = require("child_process");

function runWmic(query) {
  try {
    const out = execSync(`wmic ${query}`, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l !== "SerialNumber" && l !== "UUID")
      .join("|");
  } catch {
    return "";
  }
}

function windowsIdentifiers() {
  if (process.platform !== "win32") return "";
  const parts = [
    runWmic("csproduct get uuid"),
    runWmic("diskdrive get serialnumber"),
    runWmic("baseboard get serialnumber"),
  ];
  return parts.filter(Boolean).join("::");
}

function getMachineFingerprint() {
  const parts = [
    os.platform(),
    os.arch(),
    os.hostname(),
    String(os.cpus()?.[0]?.model || ""),
    windowsIdentifiers(),
    process.env.COMPUTERNAME || "",
    process.env.PROCESSOR_IDENTIFIER || "",
  ].filter(Boolean);

  const raw = parts.join("||");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

module.exports = { getMachineFingerprint };
