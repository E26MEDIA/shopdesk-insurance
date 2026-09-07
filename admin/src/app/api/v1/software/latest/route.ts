import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/api-utils";
import { toDirectDownloadUrl } from "@/lib/download-url";

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: publicHeaders });
}

export async function GET() {
  const latest = await prisma.softwareVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return jsonOk(
      {
        version: "0.1.0",
        downloadUrl: null,
        releaseNotes: null,
        minimumSupportedVersion: "0.1.0",
        mandatoryUpdate: false,
      },
      200,
      publicHeaders,
    );
  }

  return jsonOk(
    {
      version: latest.version,
      downloadUrl: toDirectDownloadUrl(latest.downloadUrl),
      releaseNotes: latest.releaseNotes,
      minimumSupportedVersion: latest.minimumSupportedVersion,
      mandatoryUpdate: latest.mandatoryUpdate,
      releaseDate: latest.releaseDate?.toISOString() ?? null,
    },
    200,
    publicHeaders,
  );
}
