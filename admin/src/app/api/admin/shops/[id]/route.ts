import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  gstNumber: z.string().optional(),
  businessType: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      licenses: {
        orderBy: { createdAt: "desc" },
        include: { product: true, devices: true },
      },
      devices: {
        orderBy: { firstActivatedAt: "desc" },
        include: { license: true },
      },
    },
  });

  if (!shop) return jsonError("NOT_FOUND", 404);
  return jsonOk({ shop });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (admin.role === "SUPPORT") return forbidden();

  const { id } = await params;
  try {
    const body = updateSchema.parse(await request.json());
    const shop = await prisma.shop.update({
      where: { id },
      data: {
        ...body,
        email: body.email === "" ? null : body.email,
      },
    });

    await writeAuditLog({
      adminId: admin.id,
      action: "SHOP_UPDATED",
      entityType: "shop",
      entityId: shop.id,
    });

    return jsonOk({ shop });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("UPDATE_FAILED", 500);
  }
}
