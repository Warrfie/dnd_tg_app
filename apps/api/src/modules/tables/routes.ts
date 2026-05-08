import { FastifyPluginAsync } from "fastify";
import { prisma } from "../../common/prisma.js";

export const tableRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () =>
    prisma.table.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" }
    }),
  );

  app.get("/current", async () => {
    const now = new Date();
    const tables = await prisma.table.findMany({
      where: { isActive: true },
      include: {
        bookings: {
          where: {
            status: "active",
            startAt: { lte: now },
            endAt: { gte: now }
          },
          include: {
            createdByMember: true
          },
          take: 1
        }
      },
      orderBy: { id: "asc" }
    });

    return tables.map((table) => {
      const booking = table.bookings[0];
      if (!booking) {
        return { tableId: table.id, tableName: table.name, status: "free" };
      }

      return {
        tableId: table.id,
        tableName: table.name,
        status: "busy",
        gameTitle: booking.customGameTitle,
        organizer: booking.createdByMember.firstName,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        participantsCount: booking.participantsCount,
        isPrivate: booking.isPrivate,
        openToJoin: booking.openToJoin
      };
    });
  });
};
