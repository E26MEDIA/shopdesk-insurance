import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://insurance.e26media.com";

async function main() {
  const fileUrl = `${DOWNLOAD_URL}/downloads/ShopDesk-Setup-0.1.0.exe`;

  await prisma.softwareVersion.upsert({
    where: { version: "0.1.0" },
    create: {
      version: "0.1.0",
      downloadUrl: fileUrl,
      releaseNotes: "E26 Insurance Desk for Windows",
      minimumSupportedVersion: "0.1.0",
      mandatoryUpdate: false,
      status: "PUBLISHED",
      releaseDate: new Date(),
    },
    update: {
      downloadUrl: fileUrl,
      status: "PUBLISHED",
      releaseDate: new Date(),
    },
  });

  console.log("Download URL set to:", fileUrl);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
