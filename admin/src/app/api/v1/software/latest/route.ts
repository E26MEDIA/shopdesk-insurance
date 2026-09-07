import { connection } from "next/server";
import { NextResponse } from "next/server";
import { jsonOk } from "@/lib/api-utils";
import { toCorsInstallerUrl } from "@/lib/download-url";
import { getLatestPublishedVersion } from "@/lib/public-download";

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
  await connection();
  const latest = await getLatestPublishedVersion();

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
      downloadUrl: toCorsInstallerUrl(latest.downloadUrl),
      releaseNotes: latest.releaseNotes,
      minimumSupportedVersion: latest.minimumSupportedVersion,
      mandatoryUpdate: latest.mandatoryUpdate,
      releaseDate: latest.releaseDate?.toISOString() ?? null,
    },
    200,
    publicHeaders,
  );
}
