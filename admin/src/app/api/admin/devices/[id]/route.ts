import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { deactivateDevice } from "@/lib/license-service";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "deactivate") return jsonError("INVALID_ACTION", 400);

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return jsonError("NOT_FOUND", 404);

  await deactivateDevice(id, admin.id);

  await writeAuditLog({
    adminId: admin.id,
    action: "DEVICE_DEACTIVATED",
    entityType: "device",
    entityId: id,
    metadata: { licenseId: device.licenseId, shopId: device.shopId },
  });

  return jsonOk({ ok: true });
}
