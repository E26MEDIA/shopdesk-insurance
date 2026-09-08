/**
 * Convert hosted share links into a URL that starts a native file download
 * instead of opening a preview page (Dropbox / Google Drive).
 *
 * Dropbox share pages use dl=0 (HTML preview). Chrome then either shows
 * "Can't load this file type" or, if we save via a blob: URL, "Virus detected".
 * Keep www.dropbox.com and set dl=1 so the browser follows a 302 to the
 * real attachment and downloads ShopDesk-Setup-*.exe in place.
 */
export function toDirectDownloadUrl(
  raw: string | null | undefined,
): string | null {
  const url = String(raw ?? "").trim();
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (isDropboxHost(host)) {
      return toDropboxDirectUrl(parsed, host);
    }

    if (host === "drive.google.com" || host === "docs.google.com") {
      return toGoogleDriveDirectUrl(parsed);
    }

    return url;
  } catch {
    return url;
  }
}

function isDropboxHost(host: string) {
  return (
    host === "dropbox.com" ||
    host === "www.dropbox.com" ||
    host === "dl.dropbox.com" ||
    host === "dl.dropboxusercontent.com" ||
    host.endsWith(".dropbox.com") ||
    host.endsWith(".dropboxusercontent.com")
  );
}

function isDropboxSharePath(pathname: string) {
  return /^\/(s|sh|scl\/fi)\//i.test(pathname);
}

function toDropboxDirectUrl(parsed: URL, host: string) {
  if (
    isDropboxSharePath(parsed.pathname) &&
    host !== "www.dropbox.com"
  ) {
    parsed.hostname = "www.dropbox.com";
  }

  parsed.searchParams.delete("st");
  parsed.searchParams.set("dl", "1");
  parsed.hash = "";
  return parsed.toString();
}

function toGoogleDriveDirectUrl(parsed: URL) {
  const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
  const id = fileMatch?.[1] || parsed.searchParams.get("id");
  if (!id) return parsed.toString();
  if (parsed.searchParams.get("export") === "download") return parsed.toString();
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

export function isPlausibleInstallerSize(bytes: number) {
  return Number.isFinite(bytes) && bytes >= 10 * 1024 * 1024;
}

export function isZipInstallerUrl(raw: string | null | undefined) {
  const url = String(raw ?? "").trim();
  if (!url) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".zip");
  } catch {
    return /\.zip(\?|$)/i.test(url);
  }
}

/** File name from a Dropbox / Drive share URL, e.g. ShopDesk-Setup-0.1.3.exe */
export function installerFileName(raw: string | null | undefined): string {
  const url = String(raw ?? "").trim();
  if (!url) return "";
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path.split("/").filter(Boolean).pop() || "";
  } catch {
    const match = url.match(/ShopDesk-Setup[^/?#]+/i);
    return match?.[0] || "";
  }
}

/** Dropbox scl/fi file id so a new share link is easy to tell from an old one. */
export function dropboxFileId(raw: string | null | undefined): string {
  const url = String(raw ?? "").trim();
  const match = url.match(/\/scl\/fi\/([^/?#]+)/i);
  return match?.[1] || "";
}

/** URL the browser can fetch with CORS (Dropbox share pages cannot). */
export function toCorsInstallerUrl(
  raw: string | null | undefined,
): string | null {
  const url = String(raw ?? "").trim();
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (isDropboxHost(host) && isDropboxSharePath(parsed.pathname)) {
      parsed.hostname = "dl.dropboxusercontent.com";
      parsed.searchParams.delete("st");
      parsed.searchParams.set("dl", "1");
      parsed.hash = "";
      return parsed.toString();
    }
    return toDirectDownloadUrl(url);
  } catch {
    return toDirectDownloadUrl(url);
  }
}
