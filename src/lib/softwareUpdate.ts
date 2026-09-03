import type { SoftwareUpdateInfo, UpdateDownloadState } from "./persist";
import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
export const PUBLIC_LATEST_API =
  "https://insurance.e26media.com/api/v1/software/latest";
export const UPDATE_LATER_KEY = "shopdesk-update-later-version";

export function compareVersions(a: string, b: string): number {
  const parts = (version: string) =>
    String(version || "")
      .trim()
      .replace(/^v/i, "")
      .split(/[.+-]/)
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function idleDownloadState(): UpdateDownloadState {
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

export function previewUpdateInfo(): SoftwareUpdateInfo {
  return {
    available: true,
    mandatory: false,
    currentVersion: APP_VERSION,
    latestVersion: "0.2.0",
    downloadUrl: "https://insurance.e26media.com/download",
    downloadPageUrl: "https://insurance.e26media.com/download",
    releaseNotes:
      "Future updates install on this computer from the popup. Shops do not need to open the download page again.",
    releaseDate: new Date().toISOString(),
    error: null,
    canInstallInApp: true,
    download: {
      status: "downloading",
      version: "0.2.0",
      percent: 0,
      received: 0,
      total: 100,
      path: null,
      error: null,
    },
  };
}

export async function fetchPublicUpdate(
  currentVersion = APP_VERSION,
): Promise<SoftwareUpdateInfo> {
  const downloadPageUrl = "https://insurance.e26media.com/download";
  try {
    const res = await fetch(PUBLIC_LATEST_API, { cache: "no-store" });
    if (!res.ok) throw new Error("Update check failed");
    const latest = (await res.json()) as {
      version?: string;
      downloadUrl?: string | null;
      releaseNotes?: string | null;
      minimumSupportedVersion?: string | null;
      mandatoryUpdate?: boolean;
      releaseDate?: string | null;
    };
    const latestVersion = String(latest.version || "").trim();
    const newer =
      Boolean(latestVersion) &&
      compareVersions(latestVersion, currentVersion) > 0;
    const belowMinimum = latest.minimumSupportedVersion
      ? compareVersions(currentVersion, latest.minimumSupportedVersion) < 0
      : false;
    return {
      available: newer,
      mandatory: newer && (Boolean(latest.mandatoryUpdate) || belowMinimum),
      currentVersion,
      latestVersion: latestVersion || null,
      downloadUrl: latest.downloadUrl || null,
      downloadPageUrl,
      releaseNotes: latest.releaseNotes || "",
      releaseDate: latest.releaseDate || null,
      error: null,
      canInstallInApp: Boolean(window.shopdesk?.installUpdate),
    };
  } catch (err) {
    return {
      available: false,
      mandatory: false,
      currentVersion,
      latestVersion: null,
      downloadUrl: null,
      downloadPageUrl,
      releaseNotes: "",
      releaseDate: null,
      error: err instanceof Error ? err.message : "Update check failed",
      canInstallInApp: Boolean(window.shopdesk?.installUpdate),
    };
  }
}

export async function checkSoftwareUpdate(): Promise<SoftwareUpdateInfo> {
  if (typeof window !== "undefined" && window.shopdesk?.checkForUpdate) {
    return window.shopdesk.checkForUpdate();
  }
  return fetchPublicUpdate();
}

export function postponedVersion(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(UPDATE_LATER_KEY);
}

export function postponeUpdate(version: string) {
  sessionStorage.setItem(UPDATE_LATER_KEY, version);
}

export function clearPostponedUpdate() {
  sessionStorage.removeItem(UPDATE_LATER_KEY);
}
