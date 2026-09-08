import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getPublicDownloadInfo } from "@/lib/public-download";

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
  const info = await getPublicDownloadInfo();
  return NextResponse.json(info, { headers: publicHeaders });
}
