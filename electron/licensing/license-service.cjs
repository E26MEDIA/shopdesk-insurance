const https = require("https");
const http = require("http");
const { URL } = require("url");
const { createHash } = require("crypto");
const {
  PUBLIC_KEY_PEM,
  LICENSE_API_URL,
  SKIP_LICENSE,
} = require("./config.cjs");
const { getMachineFingerprint } = require("./fingerprint.cjs");
const {
  saveToken,
  loadToken,
  saveLicenseState,
  loadLicenseState,
} = require("./token-store.cjs");

let josePromise = null;

async function getJose() {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyTokenSignature(token) {
  if (!token) return { ok: false, reason: "NO_TOKEN" };
  try {
    const { importSPKI, jwtVerify } = await getJose();
    const key = await importSPKI(PUBLIC_KEY_PEM, "Ed25519");
    const { payload } = await jwtVerify(token, key, { algorithms: ["Ed25519"] });
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: "INVALID_SIGNATURE", error: String(err.message || err) };
  }
}

function requestJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: 15000,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw || "{}") });
          } catch {
            reject(new Error("Invalid JSON response"));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(data);
    req.end();
  });
}

async function activateLicense(dataRoot, licenseKey) {
  const { hash } = getMachineFingerprint();
  const res = await requestJson(`${LICENSE_API_URL}/licenses/activate`, {
    licenseKey,
    machineFingerprint: hash,
    appVersion: process.env.npm_package_version || "0.1.0",
    deviceName: require("os").hostname(),
    operatingSystem: `${require("os").platform()} ${require("os").release()}`,
  });

  if (res.data?.token) {
    saveToken(dataRoot, res.data.token);
    saveLicenseState(dataRoot, {
      lastValidatedAt: new Date().toISOString(),
      offlineUntil: res.data.license?.offlineUntil || null,
      code: res.data.code,
    });
  }

  return res.data;
}

async function refreshLicense(dataRoot) {
  const token = loadToken(dataRoot);
  if (!token) return { code: "INVALID_LICENSE", message: "No local license." };

  const { hash } = getMachineFingerprint();
  const res = await requestJson(`${LICENSE_API_URL}/licenses/validate`, {
    token,
    machineFingerprint: hash,
    appVersion: process.env.npm_package_version || "0.1.0",
  });

  if (res.data?.token) {
    saveToken(dataRoot, res.data.token);
    saveLicenseState(dataRoot, {
      lastValidatedAt: new Date().toISOString(),
      offlineUntil: res.data.license?.offlineUntil || null,
      code: res.data.code,
    });
  }

  return res.data;
}

async function getLicenseStatus(dataRoot) {
  if (SKIP_LICENSE) {
    return {
      valid: true,
      skip: true,
      message: "Development mode — licensing skipped.",
      modules: ["customers", "vehicles", "insurance", "income", "expenses", "puc", "renewals", "reports", "reminders", "advanced_reports"],
    };
  }

  const token = loadToken(dataRoot);
  if (!token) {
    return { valid: false, needsActivation: true, message: "License activation required." };
  }

  const verified = await verifyTokenSignature(token);
  if (!verified.ok) {
    return {
      valid: false,
      needsActivation: true,
      message: "Invalid license token. Please activate again.",
    };
  }

  const payload = verified.payload;
  const fp = getMachineFingerprint().hash;
  const payloadFpHash = payload.machineFingerprintHash;
  if (payloadFpHash && payloadFpHash !== fp) {
    // Optional extra binding if server adds it later
  }

  const now = Date.now();
  const expiry = payload.expiryDate ? new Date(payload.expiryDate).getTime() : null;
  if (expiry && expiry < now) {
    return { valid: false, expired: true, message: "License expired." };
  }

  const offlineUntil = payload.offlineUntil
    ? new Date(payload.offlineUntil).getTime()
    : 0;

  const needsOnlineRefresh = offlineUntil > 0 && offlineUntil < now;

  return {
    valid: !needsOnlineRefresh,
    needsOnlineRefresh,
    offlineGraceExpired: needsOnlineRefresh,
    offlineGraceExpired: needsOnlineRefresh,
    message: needsOnlineRefresh
      ? "Please connect to the internet to validate your E26 Insurance Desk license."
      : "License valid.",
    license: {
      shopName: payload.shopName,
      edition: payload.edition,
      productName: payload.productName,
      expiryDate: payload.expiryDate,
      offlineUntil: payload.offlineUntil,
    },
    modules: payload.modules || [],
    token,
  };
}

module.exports = {
  activateLicense,
  refreshLicense,
  getLicenseStatus,
  getMachineFingerprint,
  verifyTokenSignature,
  decodeJwtPayload,
};
