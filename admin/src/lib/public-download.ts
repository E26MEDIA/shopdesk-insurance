import { prisma } from "@/lib/db";
import {
  isZipInstallerUrl,
  toCorsInstallerUrl,
  toDirectDownloadUrl,
} from "@/lib/download-url";

export async function getLatestPublishedVersion() {
  return prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: [
      { releaseDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
}

export async function getPublicDownloadInfo() {
  const latest = await getLatestPublishedVersion();

  const fallback =
    process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL?.trim() ||
    null;

  const raw = latest?.downloadUrl ?? fallback;
  const downloadUrl = isZipInstallerUrl(raw)
    ? toDirectDownloadUrl(raw)
    : toCorsInstallerUrl(raw);

  return {
    version: latest?.version ?? "0.1.0",
    downloadUrl,
    releaseNotes: latest?.releaseNotes ?? "E26 Insurance Desk for Windows",
  };
}
