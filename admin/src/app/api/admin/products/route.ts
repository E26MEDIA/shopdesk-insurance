import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      modules: { include: { module: true } },
      _count: { select: { licenses: true } },
    },
  });

  return jsonOk({ products });
}
