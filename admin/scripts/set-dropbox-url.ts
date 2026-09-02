import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOWNLOAD_URL =
  "https://www.dropbox.com/scl/fi/0kud9humhuoaudnysyp42/ShopDesk-Setup-0.1.0.exe?rlkey=bm48jri38pdclg794y9ooxnc6&st=m5mr902a&dl=1";

async function main() {
  await prisma.softwareVersion.upsert({
    where: { version: "0.1.0" },
    create: {
      version: "0.1.0",
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: "Insurance Desk for Windows",
      minimumSupportedVersion: "0.1.0",
      mandatoryUpdate: false,
      status: "PUBLISHED",
      releaseDate: new Date(),
    },
    update: {
      downloadUrl: DOWNLOAD_URL,
      status: "PUBLISHED",
      releaseNotes: "Insurance Desk for Windows",
      releaseDate: new Date(),
    },
  });

  console.log("Saved:", DOWNLOAD_URL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
