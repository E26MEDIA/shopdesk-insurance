import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const shopId = searchParams.get("shopId");
  const licenseId = searchParams.get("licenseId");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = 20;

  const where = {
    AND: [
      q
        ? {
            OR: [
              { deviceName: { contains: q, mode: "insensitive" as const } },
              { shop: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {},
      status ? { status: status as "ACTIVE" | "DEACTIVATED" } : {},
      shopId ? { shopId } : {},
      licenseId ? { licenseId } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.device.findMany({
      where,
      orderBy: { lastValidatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { shop: true, license: { include: { product: true } } },
    }),
    prisma.device.count({ where }),
  ]);

  return jsonOk({ items, total, page, limit });
}
