import { redirect } from "next/navigation";
import { getPublicDownloadInfo } from "@/lib/public-download";

export async function GET() {
  const info = await getPublicDownloadInfo();
  if (!info.downloadUrl) {
    redirect("/download");
  }
  redirect(info.downloadUrl);
}
