import { prisma } from "@/lib/db";
import { getSessionAdmin, unauthorized } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return unauthorized();

  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [
    totalShops,
    activeShops,
    totalLicenses,
    activeLicenses,
    expiredLicenses,
    suspendedLicenses,
    totalDevices,
    activeDevices,
    expiringSoon,
    recentShops,
    recentLicenses,
    recentActivations,
    recentDeactivations,
    shopsByMonth,
    licensesByMonth,
    activationsByMonth,
    licenseStatusCounts,
    productDistribution,
  ] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { status: "ACTIVE" } }),
    prisma.license.count(),
    prisma.license.count({ where: { status: "ACTIVE" } }),
    prisma.license.count({ where: { status: "EXPIRED" } }),
    prisma.license.count({ where: { status: "SUSPENDED" } }),
    prisma.device.count(),
    prisma.device.count({ where: { status: "ACTIVE" } }),
    prisma.license.count({
      where: {
        status: "ACTIVE",
        expiryDate: { gte: now, lte: soon },
      },
    }),
    prisma.shop.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.license.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { shop: true, product: true },
    }),
    prisma.activation.findMany({
      where: { activationType: "ACTIVATE", result: "SUCCESS" },
      orderBy: { timestamp: "desc" },
      take: 5,
      include: { license: { include: { shop: true } }, device: true },
    }),
    prisma.activation.findMany({
      where: { activationType: "DEACTIVATE" },
      orderBy: { timestamp: "desc" },
      take: 5,
      include: { device: true, license: { include: { shop: true } } },
    }),
    prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
      FROM shops GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
      FROM licenses GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(timestamp, 'YYYY-MM') as month, COUNT(*)::bigint as count
      FROM activations WHERE result = 'SUCCESS' AND activation_type = 'ACTIVATE'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    prisma.license.groupBy({ by: ["status"], _count: true }),
    prisma.license.groupBy({ by: ["edition"], _count: true }),
  ]);

  const allowedSlots = await prisma.license.aggregate({
    _sum: { allowedDevices: true },
    where: { status: "ACTIVE" },
  });

  return jsonOk({
    cards: {
      totalShops,
      activeShops,
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      suspendedLicenses,
      totalDevices,
      activeDevices,
      availableDeviceSlots:
        (allowedSlots._sum.allowedDevices ?? 0) - activeDevices,
      licensesExpiringSoon: expiringSoon,
    },
    recent: {
      shops: recentShops,
      licenses: recentLicenses,
      activations: recentActivations,
      deactivations: recentDeactivations,
    },
    charts: {
      shopsByMonth: shopsByMonth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      licensesByMonth: licensesByMonth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      activationsByMonth: activationsByMonth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      licenseStatus: licenseStatusCounts.map((r) => ({
        status: r.status,
        count: r._count,
      })),
      productDistribution: productDistribution.map((r) => ({
        edition: r.edition,
        count: r._count,
      })),
    },
  });
}
