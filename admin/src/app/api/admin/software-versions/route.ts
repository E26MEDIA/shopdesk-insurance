import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { canManageProducts } from "@/lib/audit";
import { toDirectDownloadUrl } from "@/lib/download-url";

const schema = z.object({
  version: z.string().min(1),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().optional(),
  mandatoryUpdate: z.boolean().optional(),
  minimumSupportedVersion: z.string().optional(),
});

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (!canManageProducts(admin.role)) return forbidden();

  try {
    const body = schema.parse(await request.json());
    const downloadUrl =
      toDirectDownloadUrl(body.downloadUrl) ?? body.downloadUrl;
    const row = await prisma.softwareVersion.upsert({
      where: { version: body.version },
      create: {
        version: body.version,
        downloadUrl,
        releaseNotes: body.releaseNotes,
        status: "PUBLISHED",
        releaseDate: new Date(),
        minimumSupportedVersion: body.minimumSupportedVersion || body.version,
        mandatoryUpdate: body.mandatoryUpdate ?? false,
      },
      update: {
        downloadUrl,
        releaseNotes: body.releaseNotes,
        status: "PUBLISHED",
        releaseDate: new Date(),
        mandatoryUpdate: body.mandatoryUpdate ?? false,
        ...(body.minimumSupportedVersion
          ? { minimumSupportedVersion: body.minimumSupportedVersion }
          : {}),
      },
    });
    return jsonOk({ version: row });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("SAVE_FAILED", 500);
  }
}
