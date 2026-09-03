const https = require("https");
const http = require("http");
const { URL } = require("url");
const { LICENSE_API_URL } = require("./licensing/config.cjs");

function parseVersionParts(version) {
  return String(version || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareVersions(a, b) {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function downloadPageUrl(apiUrl = LICENSE_API_URL) {
  try {
    return `${new URL(apiUrl).origin}/download`;
  } catch {
    return "https://insurance.e26media.com/download";
  }
}

function latestUrl(apiUrl = LICENSE_API_URL) {
  return `${String(apiUrl).replace(/\/$/, "")}/software/latest`;
}

function decideUpdate(input) {
  const currentVersion = String(input.currentVersion || "0.0.0").trim() || "0.0.0";
  const latestVersion = String(input.latestVersion || "").trim();
  const downloadUrl = input.downloadUrl || null;
  const releaseNotes = input.releaseNotes || "";
  const releaseDate = input.releaseDate || null;

  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    return {
      available: false,
      mandatory: false,
      currentVersion,
      latestVersion: latestVersion || null,
      downloadUrl,
      releaseNotes,
      releaseDate,
    };
  }

  const belowMinimum = input.minimumSupportedVersion
    ? compareVersions(currentVersion, input.minimumSupportedVersion) < 0
    : false;

  return {
    available: true,
    mandatory: Boolean(input.mandatoryUpdate) || belowMinimum,
    currentVersion,
    latestVersion,
    downloadUrl,
    releaseNotes,
    releaseDate,
  };
}

function requestJsonGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { Accept: "application/json" },
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
    req.end();
  });
}

async function fetchLatestSoftware(apiUrl = LICENSE_API_URL) {
  const res = await requestJsonGet(latestUrl(apiUrl));
  if (!res.status || res.status >= 400) {
    throw new Error("Update check failed");
  }
  return res.data;
}

async function checkForSoftwareUpdate(currentVersion, apiUrl = LICENSE_API_URL) {
  try {
    const latest = await fetchLatestSoftware(apiUrl);
    const decision = decideUpdate({
      currentVersion,
      latestVersion: latest.version,
      downloadUrl: latest.downloadUrl,
      releaseNotes: latest.releaseNotes,
      minimumSupportedVersion: latest.minimumSupportedVersion,
      mandatoryUpdate: latest.mandatoryUpdate,
      releaseDate: latest.releaseDate,
    });
    return {
      ...decision,
      downloadPageUrl: downloadPageUrl(apiUrl),
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      mandatory: false,
      currentVersion,
      latestVersion: null,
      downloadUrl: null,
      downloadPageUrl: downloadPageUrl(apiUrl),
      releaseNotes: "",
      releaseDate: null,
      error: String(err.message || err),
    };
  }
}

module.exports = {
  compareVersions,
  decideUpdate,
  downloadPageUrl,
  latestUrl,
  fetchLatestSoftware,
  checkForSoftwareUpdate,
  requestJsonGet,
};
