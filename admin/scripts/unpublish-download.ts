import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.softwareVersion.updateMany({
    where: { version: "0.1.0" },
    data: { status: "DRAFT" },
  });
  console.log("Unpublished version 0.1.0 — set Google Drive link in Admin → Download");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
