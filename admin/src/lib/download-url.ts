/**
 * Convert hosted share links into a URL that starts a file download
 * instead of opening a preview page (Dropbox / Google Drive).
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
    (host === "dropbox.com" ||
      host === "www.dropbox.com" ||
      host === "dl.dropbox.com")
  ) {
    parsed.hostname = "dl.dropboxusercontent.com";
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
