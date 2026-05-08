import { buildServer } from "./app.js";
import { prisma } from "./common/prisma.js";
import { ensureSeedData } from "./common/seed.js";
import { env } from "./config.js";

async function start() {
  await prisma.$connect();
  await ensureSeedData();
  const app = buildServer();

  await app.listen({
    host: "0.0.0.0",
    port: env.PORT
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
