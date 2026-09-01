import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULES = [
  { moduleKey: "customers", name: "Customer Management" },
  { moduleKey: "vehicles", name: "Vehicle Management" },
  { moduleKey: "insurance", name: "Insurance Management" },
  { moduleKey: "income", name: "Income" },
  { moduleKey: "expenses", name: "Expenses" },
  { moduleKey: "puc", name: "PUC / Emission" },
  { moduleKey: "renewals", name: "Renewal Management" },
  { moduleKey: "reports", name: "Reports" },
  { moduleKey: "reminders", name: "Reminder System" },
  { moduleKey: "advanced_reports", name: "Advanced Reports" },
];

const EDITION_MODULES: Record<string, string[]> = {
  Basic: ["customers", "vehicles", "insurance", "income", "expenses"],
  Professional: [
    "customers",
    "vehicles",
    "insurance",
    "income",
    "expenses",
    "puc",
    "renewals",
    "reports",
    "reminders",
  ],
  Business: MODULES.map((m) => m.moduleKey),
};

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@e26media.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow!123";
  const passwordHash = await bcrypt.hash(password, 12);

  const { privateKey, publicKey } = await generateKeyPair("Ed25519", {
    extractable: true,
  });
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  console.log("\n--- Add these to admin/.env ---");
  console.log(`LICENSE_SIGNING_PRIVATE_KEY="${privatePem.replace(/\n/g, "\\n")}"`);
  console.log(`LICENSE_SIGNING_PUBLIC_KEY="${publicPem.replace(/\n/g, "\\n")}"`);
  console.log("--- Copy public key to desktop app as well ---\n");

  await prisma.systemSetting.upsert({
    where: { key: "offline_grace_days" },
    create: { key: "offline_grace_days", value: "30" },
    update: { value: "30" },
  });

  const admin = await prisma.admin.upsert({
    where: { email },
    create: {
      email,
      name: "E26 Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    update: { passwordHash, status: "ACTIVE" },
  });

  for (const mod of MODULES) {
    await prisma.module.upsert({
      where: { moduleKey: mod.moduleKey },
      create: { ...mod, status: "ACTIVE" },
      update: { name: mod.name, status: "ACTIVE" },
    });
  }

  const product = await prisma.product.upsert({
    where: { id: "seed-insurance-desk" },
    create: {
      id: "seed-insurance-desk",
      name: "E26 Insurance Desk",
      description: "Offline-first insurance shop management software",
      status: "ACTIVE",
    },
    update: {
      name: "E26 Insurance Desk",
      status: "ACTIVE",
    },
  });

  const allModules = await prisma.module.findMany();
  for (const mod of allModules) {
    await prisma.productModule.upsert({
      where: {
        productId_moduleId: { productId: product.id, moduleId: mod.id },
      },
      create: { productId: product.id, moduleId: mod.id },
      update: {},
    });
  }

  await prisma.softwareVersion.upsert({
    where: { version: "0.1.0" },
    create: {
      version: "0.1.0",
      downloadUrl: "https://insurance.e26media.com/downloads",
      releaseNotes: "Initial E26 Insurance Desk release",
      minimumSupportedVersion: "0.1.0",
      mandatoryUpdate: false,
      status: "PUBLISHED",
      releaseDate: new Date(),
    },
    update: { status: "PUBLISHED" },
  });

  console.log("Seed complete.");
  console.log(`Admin: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Admin ID: ${admin.id}`);
  console.log(`Product: ${product.name} (${product.id})`);
  console.log("Editions available: Basic, Professional, Business");
  console.log("Edition modules:", JSON.stringify(EDITION_MODULES, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
