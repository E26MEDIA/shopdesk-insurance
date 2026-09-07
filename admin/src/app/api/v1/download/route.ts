import { NextResponse } from "next/server";
import { getPublicDownloadInfo } from "@/lib/public-download";

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
  const info = await getPublicDownloadInfo();
  return NextResponse.json(info, { headers: publicHeaders });
}
