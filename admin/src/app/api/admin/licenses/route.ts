import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { writeAuditLog, canCreateLicense } from "@/lib/audit";
import {
  generateLicenseDisplayId,
  generateLicenseKey,
  hashLicenseKey,
} from "@/lib/crypto";

const createSchema = z.object({
  shopId: z.string(),
  productId: z.string(),
  edition: z.string().min(1),
  allowedDevices: z.number().int().min(1).max(100),
  validityDays: z.number().int().min(0).nullable(),
  lifetime: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const shopId = searchParams.get("shopId");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = 20;

  const where = {
    AND: [
      q
        ? {
            OR: [
              { licenseDisplayId: { contains: q, mode: "insensitive" as const } },
              { edition: { contains: q, mode: "insensitive" as const } },
              { shop: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {},
      status ? { status: status as never } : {},
      shopId ? { shopId } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.license.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        shop: true,
        product: true,
        devices: true,
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.license.count({ where }),
  ]);

  return jsonOk({ items, total, page, limit });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (!canCreateLicense(admin.role)) return forbidden();

  try {
    const body = createSchema.parse(await request.json());
    const licenseKey = generateLicenseKey();
    const startDate = new Date();
    let expiryDate: Date | null = null;

    if (!body.lifetime && body.validityDays && body.validityDays > 0) {
      expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + body.validityDays);
    }

    const license = await prisma.license.create({
      data: {
        licenseKeyHash: hashLicenseKey(licenseKey),
        licenseDisplayId: generateLicenseDisplayId(),
        shopId: body.shopId,
        productId: body.productId,
        edition: body.edition,
        startDate,
        expiryDate,
        allowedDevices: body.allowedDevices,
        status: "PENDING",
        notes: body.notes,
        createdById: admin.id,
      },
      include: { shop: true, product: true },
    });

    await writeAuditLog({
      adminId: admin.id,
      action: "LICENSE_CREATED",
      entityType: "license",
      entityId: license.id,
      metadata: {
        shopId: license.shopId,
        edition: license.edition,
        allowedDevices: license.allowedDevices,
      },
    });

    return jsonOk({ license, licenseKey }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("CREATE_FAILED", 500);
  }
}
