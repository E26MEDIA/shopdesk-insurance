import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized, forbidden } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { writeAuditLog } from "@/lib/audit";
import { generateShopCode } from "@/lib/crypto";

const shopSchema = z.object({
  shopCode: z.string().optional(),
  name: z.string().min(1),
  ownerName: z.string().min(1),
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

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = 20;

  const where = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { ownerName: { contains: q, mode: "insensitive" as const } },
              { shopCode: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      status ? { status: status as "ACTIVE" | "SUSPENDED" | "CLOSED" } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        licenses: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { product: true, devices: { where: { status: "ACTIVE" } } },
        },
        _count: { select: { licenses: true, devices: true } },
      },
    }),
    prisma.shop.count({ where }),
  ]);

  return jsonOk({ items, total, page, limit });
}

export async function POST(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();
  if (admin.role === "SUPPORT") return forbidden();

  try {
    const body = shopSchema.parse(await request.json());
    const shop = await prisma.shop.create({
      data: {
        shopCode: body.shopCode || generateShopCode(),
        name: body.name,
        ownerName: body.ownerName,
        phone: body.phone,
        email: body.email || null,
        address: body.address,
        city: body.city,
        state: body.state,
        country: body.country || "India",
        gstNumber: body.gstNumber,
        businessType: body.businessType,
        notes: body.notes,
        status: body.status || "ACTIVE",
      },
    });

    await writeAuditLog({
      adminId: admin.id,
      action: "SHOP_CREATED",
      entityType: "shop",
      entityId: shop.id,
      metadata: { shopCode: shop.shopCode },
    });

    return jsonOk({ shop }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("CREATE_FAILED", 500);
  }
}
