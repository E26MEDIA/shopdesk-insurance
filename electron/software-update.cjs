const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { LICENSE_API_URL } = require("./licensing/config.cjs");
const { extractWindowsInstallerFromZip } = require("./unzip-installer.cjs");

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

function safeVersion(version) {
  return String(version || "")
    .replace(/[^0-9A-Za-z.-]/g, "")
    .slice(0, 32) || "update";
}

function installerFileName(version) {
  return `ShopDesk-Setup-${safeVersion(version)}.exe`;
}

function installerPathFor(updatesDir, version) {
  return path.join(updatesDir, installerFileName(version));
}

function isWindowsInstaller(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(2);
      const read = fs.readSync(fd, buf, 0, 2, 0);
      return read === 2 && buf[0] === 0x4d && buf[1] === 0x5a;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

function isZipArchive(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(4);
      const read = fs.readSync(fd, buf, 0, 4, 0);
      return (
        read >= 4 &&
        buf[0] === 0x50 &&
        buf[1] === 0x4b &&
        (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
      );
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

function finalizeDownloadedInstaller(tmpPath, destPath) {
  if (isWindowsInstaller(tmpPath)) {
    fs.renameSync(tmpPath, destPath);
    return destPath;
  }
  if (isZipArchive(tmpPath)) {
    extractWindowsInstallerFromZip(tmpPath, destPath);
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    if (!isWindowsInstaller(destPath)) {
      try {
        fs.unlinkSync(destPath);
      } catch {
        /* ignore */
      }
      throw new Error("Zip does not contain a Windows installer");
    }
    return destPath;
  }
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore */
  }
  throw new Error("Downloaded file is not a Windows installer");
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

function idleDownloadState() {
  return {
    status: "idle",
    version: null,
    percent: 0,
    received: 0,
    total: 0,
    path: null,
    error: null,
  };
}

function downloadInstaller(url, destPath, onProgress, redirectCount = 0) {
  if (redirectCount > 8) {
    return Promise.reject(new Error("Too many redirects"));
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return Promise.reject(new Error("Invalid download URL"));
  }

  return new Promise((resolve, reject) => {
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          Accept: "*/*",
          "User-Agent": "InsuranceDesk-Updater",
        },
      },
      (res) => {
        const location = res.headers.location;
        if (res.statusCode >= 300 && res.statusCode < 400 && location) {
          const next = new URL(location, url).toString();
          res.resume();
          downloadInstaller(next, destPath, onProgress, redirectCount + 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed (${res.statusCode})`));
          return;
        }

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const tmpPath = `${destPath}.part`;
        const file = fs.createWriteStream(tmpPath);
        const total = Number(res.headers["content-length"] || 0);
        let received = 0;

        res.on("data", (chunk) => {
          received += chunk.length;
          if (typeof onProgress === "function") {
            onProgress({
              received,
              total,
              percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
            });
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try {
              finalizeDownloadedInstaller(tmpPath, destPath);
              if (typeof onProgress === "function") {
                onProgress({ received, total: received, percent: 100 });
              }
              resolve({ path: destPath, size: fs.statSync(destPath).size });
            } catch (err) {
              reject(err);
            }
          });
        });
        file.on("error", (err) => {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            /* ignore */
          }
          reject(err);
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(10 * 60 * 1000, () => {
      req.destroy();
      reject(new Error("Download timeout"));
    });
    req.end();
  });
}

function existingInstaller(updatesDir, version) {
  const dest = installerPathFor(updatesDir, version);
  try {
    if (fs.existsSync(dest) && isWindowsInstaller(dest) && fs.statSync(dest).size > 64) {
      return dest;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function cleanupOldInstallers(updatesDir, keepVersion) {
  if (!fs.existsSync(updatesDir)) return;
  const keep = installerFileName(keepVersion);
  for (const name of fs.readdirSync(updatesDir)) {
    if (name === keep) continue;
    if (!/\.(exe|zip|part)$/i.test(name)) continue;
    try {
      fs.unlinkSync(path.join(updatesDir, name));
    } catch {
      /* ignore */
    }
  }
}

function createUpdateManager({ updatesDir, onProgress }) {
  let state = idleDownloadState();
  let inFlight = null;

  function snapshot() {
    return { ...state };
  }

  function emit() {
    if (typeof onProgress === "function") onProgress(snapshot());
  }

  async function ensureDownloaded({ version, downloadUrl }) {
    if (!version || !downloadUrl) {
      state = { ...idleDownloadState(), status: "error", error: "Missing installer URL" };
      emit();
      return snapshot();
    }

    const existing = existingInstaller(updatesDir, version);
    if (existing) {
      const size = fs.statSync(existing).size;
      state = {
        status: "ready",
        version,
        percent: 100,
        received: size,
        total: size,
        path: existing,
        error: null,
      };
      emit();
      return snapshot();
    }

    if (inFlight && state.version === version) return inFlight;

    fs.mkdirSync(updatesDir, { recursive: true });
    cleanupOldInstallers(updatesDir, version);
    const dest = installerPathFor(updatesDir, version);
    state = {
      status: "downloading",
      version,
      percent: 0,
      received: 0,
      total: 0,
      path: null,
      error: null,
    };
    emit();

    inFlight = downloadInstaller(downloadUrl, dest, (progress) => {
      state = {
        ...state,
        status: "downloading",
        received: progress.received,
        total: progress.total,
        percent: progress.percent,
      };
      emit();
    })
      .then((result) => {
        state = {
          status: "ready",
          version,
          percent: 100,
          received: result.size,
          total: result.size,
          path: result.path,
          error: null,
        };
        emit();
        return snapshot();
      })
      .catch((err) => {
        state = {
          ...state,
          status: "error",
          error: String(err.message || err),
          path: null,
        };
        emit();
        return snapshot();
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return {
    snapshot,
    ensureDownloaded,
    installerPath: () => state.path,
  };
}

async function launchInstaller(installerPath, opener) {
  if (!installerPath || !fs.existsSync(installerPath)) {
    throw new Error("Installer not downloaded yet");
  }
  if (!isWindowsInstaller(installerPath)) {
    throw new Error("Downloaded file is not a Windows installer");
  }
  if (typeof opener !== "function") {
    throw new Error("Cannot launch installer");
  }
  await opener(installerPath, nsisSilentUpdateArgs());
  return { ok: true, path: installerPath };
}

/** NSIS flags: upgrade in place, no setup wizard, reopen the app. */
function nsisSilentUpdateArgs() {
  return ["--updated", "/S", "--force-run"];
}

module.exports = {
  compareVersions,
  decideUpdate,
  downloadPageUrl,
  latestUrl,
  fetchLatestSoftware,
  checkForSoftwareUpdate,
  requestJsonGet,
  safeVersion,
  installerFileName,
  installerPathFor,
  isWindowsInstaller,
  isZipArchive,
  downloadInstaller,
  existingInstaller,
  createUpdateManager,
  launchInstaller,
  nsisSilentUpdateArgs,
  idleDownloadState,
};
