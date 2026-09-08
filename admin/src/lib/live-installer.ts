import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { toDirectDownloadUrl } from "@/lib/download-url";

export const LIVE_INSTALLER_KEY = "live_installer";

export type LiveInstaller = {
  version: string;
  /** Canonical URL used for customer downloads (dl=1 / direct). */
  downloadUrl: string;
  /** Exact share link pasted in Admin → Software. */
  shareUrl: string;
  releaseNotes: string;
  mandatoryUpdate: boolean;
  minimumSupportedVersion: string;
};

export function parseLiveInstaller(raw: unknown): LiveInstaller | null {
  let data = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const downloadUrl = String(row.downloadUrl || "").trim();
  const version = String(row.version || "").trim();
  if (!downloadUrl || !version) return null;
  const shareUrl = String(row.shareUrl || "").trim() || downloadUrl;
  return {
    version,
    downloadUrl,
    shareUrl,
    releaseNotes: String(row.releaseNotes || ""),
    mandatoryUpdate: Boolean(row.mandatoryUpdate),
    minimumSupportedVersion:
      String(row.minimumSupportedVersion || "").trim() || version,
  };
}

/** Show the pasted Dropbox link in admin, not a rewritten CDN URL. */
export function adminDisplayUrl(live: LiveInstaller): string {
  return live.shareUrl || live.downloadUrl;
}

export async function getLiveInstaller(): Promise<LiveInstaller | null> {
  await connection();
  const setting = await prisma.systemSetting.findUnique({
    where: { key: LIVE_INSTALLER_KEY },
  });
  const fromSetting = parseLiveInstaller(setting?.value);
  if (fromSetting) return fromSetting;

  const latest = await prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: [
      { releaseDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
  if (!latest?.downloadUrl) return null;
  return {
    version: latest.version,
    downloadUrl: latest.downloadUrl,
    shareUrl: latest.downloadUrl,
    releaseNotes: latest.releaseNotes || "",
    mandatoryUpdate: latest.mandatoryUpdate,
    minimumSupportedVersion:
      latest.minimumSupportedVersion || latest.version,
  };
}

export async function saveLiveInstaller(input: {
  version: string;
  shareUrl: string;
  releaseNotes?: string;
  mandatoryUpdate?: boolean;
  minimumSupportedVersion?: string;
}): Promise<LiveInstaller> {
  const shareUrl = input.shareUrl.trim();
  const downloadUrl = toDirectDownloadUrl(shareUrl) || shareUrl;
  const live: LiveInstaller = {
    version: input.version.trim(),
    downloadUrl,
    shareUrl,
    releaseNotes: input.releaseNotes || "",
    mandatoryUpdate: Boolean(input.mandatoryUpdate),
    minimumSupportedVersion:
      input.minimumSupportedVersion?.trim() || input.version.trim(),
  };

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: LIVE_INSTALLER_KEY },
      create: { key: LIVE_INSTALLER_KEY, value: JSON.stringify(live) },
      update: { value: JSON.stringify(live) },
    }),
    prisma.softwareVersion.upsert({
      where: { version: live.version },
      create: {
        version: live.version,
        downloadUrl: live.downloadUrl,
        releaseNotes: live.releaseNotes,
        status: "PUBLISHED",
        releaseDate: new Date(),
        minimumSupportedVersion: live.minimumSupportedVersion,
        mandatoryUpdate: live.mandatoryUpdate,
      },
      update: {
        downloadUrl: live.downloadUrl,
        releaseNotes: live.releaseNotes,
        status: "PUBLISHED",
        releaseDate: new Date(),
        mandatoryUpdate: live.mandatoryUpdate,
        minimumSupportedVersion: live.minimumSupportedVersion,
      },
    }),
  ]);

  return live;
}
