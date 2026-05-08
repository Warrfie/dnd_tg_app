import { FastifyPluginAsync } from "fastify";
import { prisma } from "../../common/prisma.js";

export const memberRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const items = await prisma.member.findMany({
      where: { isActive: true },
      orderBy: { firstName: "asc" }
    });

    return {
      items: items.map((member) => ({
        id: member.id,
        firstName: member.firstName,
        username: member.username,
        isAdmin: member.isAdmin
      }))
    };
  });
};
