import { connection } from "next/server";
import { z } from "zod";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { canManageProducts } from "@/lib/audit";
import { dropboxFileId, installerFileName } from "@/lib/download-url";
import {
  adminDisplayUrl,
  getLiveInstaller,
  saveLiveInstaller,
} from "@/lib/live-installer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  version: z.string().min(1),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().optional(),
  mandatoryUpdate: z.boolean().optional(),
  minimumSupportedVersion: z.string().optional(),
});

const noStore = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function payload(live: Awaited<ReturnType<typeof getLiveInstaller>>) {
  if (!live) {
    return {
      version: "0.1.0",
      downloadUrl: "",
      releaseNotes: "",
      mandatoryUpdate: false,
      fileName: "",
      fileId: "",
    };
  }
  const downloadUrl = adminDisplayUrl(live);
  return {
    version: live.version,
    downloadUrl,
    releaseNotes: live.releaseNotes,
    mandatoryUpdate: live.mandatoryUpdate,
    fileName: installerFileName(downloadUrl),
    fileId: dropboxFileId(downloadUrl),
  };
}

export async function GET() {
  await connection();
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const live = await getLiveInstaller();
  return jsonOk(payload(live), 200, noStore);
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (!canManageProducts(admin.role)) return forbidden();

  try {
    const body = schema.parse(await request.json());
    const live = await saveLiveInstaller({
      version: body.version,
      shareUrl: body.downloadUrl,
      releaseNotes: body.releaseNotes,
      mandatoryUpdate: body.mandatoryUpdate,
      minimumSupportedVersion: body.minimumSupportedVersion,
    });
    return jsonOk({ version: payload(live) }, 200, noStore);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("SAVE_FAILED", 500);
  }
}
