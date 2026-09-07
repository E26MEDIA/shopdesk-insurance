import { prisma } from "@/lib/db";
import { toCorsInstallerUrl } from "@/lib/download-url";

export async function getPublicDownloadInfo() {
  const latest = await prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  const fallback =
    process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL?.trim() ||
    null;

  return {
    version: latest?.version ?? "0.1.0",
    downloadUrl: toCorsInstallerUrl(latest?.downloadUrl ?? fallback),
    releaseNotes: latest?.releaseNotes ?? "E26 Insurance Desk for Windows",
  };
}
