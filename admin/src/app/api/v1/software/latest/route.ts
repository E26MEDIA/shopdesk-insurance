import { connection } from "next/server";
import { NextResponse } from "next/server";
import { jsonOk } from "@/lib/api-utils";
import { toCorsInstallerUrl } from "@/lib/download-url";
import { getLiveInstaller } from "@/lib/live-installer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: publicHeaders });
}

export async function GET() {
  await connection();
  const live = await getLiveInstaller();

  if (!live) {
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
      version: live.version,
      downloadUrl: toCorsInstallerUrl(live.downloadUrl),
      releaseNotes: live.releaseNotes,
      minimumSupportedVersion: live.minimumSupportedVersion,
      mandatoryUpdate: live.mandatoryUpdate,
      releaseDate: null,
    },
    200,
    publicHeaders,
  );
}
