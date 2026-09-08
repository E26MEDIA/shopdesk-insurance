import { connection } from "next/server";
import {
  isZipInstallerUrl,
  toCorsInstallerUrl,
  toDirectDownloadUrl,
} from "@/lib/download-url";
import { getLiveInstaller } from "@/lib/live-installer";

export async function getPublicDownloadInfo() {
  await connection();
  const live = await getLiveInstaller();

  const fallback =
    process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL?.trim() ||
    null;

  const raw = live?.downloadUrl ?? fallback;
  const downloadUrl = isZipInstallerUrl(raw)
    ? toDirectDownloadUrl(raw)
    : toCorsInstallerUrl(raw);

  return {
    version: live?.version ?? "0.1.0",
    downloadUrl,
    releaseNotes: live?.releaseNotes ?? "E26 Insurance Desk for Windows",
  };
}
