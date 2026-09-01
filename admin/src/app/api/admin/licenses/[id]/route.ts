import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { writeAuditLog, canSuspendLicense } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"]).optional(),
  allowedDevices: z.number().int().min(1).max(100).optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
  edition: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;
  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      shop: true,
      product: true,
      devices: true,
      activations: { orderBy: { timestamp: "desc" }, take: 50 },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!license) return jsonError("NOT_FOUND", 404);
  return jsonOk({ license });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (!canSuspendLicense(admin.role)) return forbidden();

  const { id } = await params;
  try {
    const body = patchSchema.parse(await request.json());
    const license = await prisma.license.update({
      where: { id },
      data: {
        status: body.status,
        allowedDevices: body.allowedDevices,
        expiryDate:
          body.expiryDate === null
            ? null
            : body.expiryDate
              ? new Date(body.expiryDate)
              : undefined,
        notes: body.notes,
        edition: body.edition,
      },
    });

    const action =
      body.status === "SUSPENDED"
        ? "LICENSE_SUSPENDED"
        : body.status === "REVOKED"
          ? "LICENSE_REVOKED"
          : body.status === "ACTIVE"
            ? "LICENSE_REACTIVATED"
            : "LICENSE_UPDATED";

    await writeAuditLog({
      adminId: admin.id,
      action,
      entityType: "license",
      entityId: license.id,
      metadata: { status: license.status },
    });

    return jsonOk({ license });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("UPDATE_FAILED", 500);
  }
}
