import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = 50;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { admin: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return jsonOk({ items, total, page, limit });
}
