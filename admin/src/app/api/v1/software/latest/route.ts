import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  const latest = await prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return jsonOk({
      version: "0.1.0",
      downloadUrl: null,
      releaseNotes: null,
      minimumSupportedVersion: "0.1.0",
      mandatoryUpdate: false,
    });
  }

  return jsonOk({
    version: latest.version,
    downloadUrl: latest.downloadUrl,
    releaseNotes: latest.releaseNotes,
    minimumSupportedVersion: latest.minimumSupportedVersion,
    mandatoryUpdate: latest.mandatoryUpdate,
    releaseDate: latest.releaseDate?.toISOString() ?? null,
  });
}
