import { prisma } from "../common/prisma.js";
import { ensureSeedData } from "../common/seed.js";

async function main() {
  await prisma.$connect();
  await ensureSeedData();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
