/**
 * Remove all client/shop data from admin DB. Keeps admins, products, download settings.
 * Run: cd admin && npx tsx scripts/clear-client-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [activations, devices, licenses, shops, auditLogs] = await prisma.$transaction([
    prisma.activation.deleteMany(),
    prisma.device.deleteMany(),
    prisma.license.deleteMany(),
    prisma.shop.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);

  console.log("Cleared admin client data:");
  console.log(`  activations: ${activations.count}`);
  console.log(`  devices: ${devices.count}`);
  console.log(`  licenses: ${licenses.count}`);
  console.log(`  shops: ${shops.count}`);
  console.log(`  audit logs: ${auditLogs.count}`);
  console.log("Kept: admins, products, modules, software download URL");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
