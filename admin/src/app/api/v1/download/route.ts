import { prisma } from "@/lib/db";

export async function GET() {
  const latest = await prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    version: latest?.version ?? "0.1.0",
    downloadUrl:
      latest?.downloadUrl ??
      process.env.NEXT_PUBLIC_DOWNLOAD_URL ??
      process.env.NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL ??
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/downloads/ShopDesk-Setup-0.1.0.exe`
        : null),
    releaseNotes: latest?.releaseNotes ?? "E26 Insurance Desk for Windows",
  });
}
