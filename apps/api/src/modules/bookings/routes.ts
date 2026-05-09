import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { requireTelegramMember } from "../auth/current-member.js";
import { assertBookingRules } from "./validators.js";
import { serializeBooking } from "./serializers.js";

const bookingSchema = z.object({
  tableId: z.number().int().min(1).max(2),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  gameTitle: z.string().min(1).max(120),
  description: z.string().max(4000).optional().default(""),
  participantsCount: z.number().int().min(1).max(20),
  isPrivate: z.boolean().default(false)
});

const bookingParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const bookingParticipantParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive()
});

async function findBookingWithRelations(id: number) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      table: true,
      createdByMember: true,
      participants: {
        include: {
          member: true
        }
      }
    }
  });
}

export const bookingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const querySchema = z.object({
      from: z.string().optional(),
      to: z.string().optional()
    });
    const query = querySchema.parse(request.query);
    const where =
      query.from || query.to
        ? {
            startAt: {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined
            }
          }
        : {};

    const items = await prisma.booking.findMany({
      where,
      include: {
        table: true,
        createdByMember: true,
        participants: {
          include: {
            member: true
          }
        }
      },
      orderBy: {
        startAt: "asc"
      }
    });

    return { items: items.map(serializeBooking) };
  });

  app.get("/:id", async (request, reply) => {
    const params = bookingParamsSchema.parse(request.params);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    return serializeBooking(booking);
  });

  app.post("/", async (request, reply) => {
    const creator = await requireTelegramMember(request, reply);
    if (!creator) {
      return;
    }

    const payload = bookingSchema.parse(request.body);
    const startAt = new Date(`${payload.date}T${payload.startTime}:00`);
    const endAt = new Date(`${payload.date}T${payload.endTime}:00`);

    try {
      assertBookingRules(startAt, endAt);
    } catch (error) {
      return reply.status(400).send({
        ok: false,
        error: error instanceof Error ? error.message : "Invalid booking"
      });
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        tableId: payload.tableId,
        status: "active",
        startAt: {
          lt: endAt
        },
        endAt: {
          gt: startAt
        }
      }
    });

    if (overlapping) {
      return reply.status(409).send({
        ok: false,
        error: "Этот стол уже занят в выбранное время"
      });
    }

    const booking = await prisma.booking.create({
      data: {
        tableId: payload.tableId,
        createdByMemberId: creator.id,
        customGameTitle: payload.gameTitle,
        description: payload.description,
        startAt,
        endAt,
        isPrivate: payload.isPrivate,
        openToJoin: !payload.isPrivate,
        participantsCount: payload.participantsCount,
        participants: {
          create: {
            memberId: creator.id,
            role: "organizer"
          }
        }
      },
      include: { table: true, createdByMember: true, participants: { include: { member: true } } }
    });

    return reply.status(201).send(serializeBooking(booking));
  });

  app.patch("/:id", async (request, reply) => {
    const currentMember = await requireTelegramMember(request, reply);
    if (!currentMember) {
      return;
    }

    const params = bookingParamsSchema.parse(request.params);
    const payload = bookingSchema.parse(request.body);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    if (booking.createdByMember.telegramUserId?.toString() !== currentMember.telegramUserId?.toString()) {
      return reply.status(403).send({ ok: false, error: "Редактировать бронь может только создатель" });
    }

    const startAt = new Date(`${payload.date}T${payload.startTime}:00`);
    const endAt = new Date(`${payload.date}T${payload.endTime}:00`);

    try {
      assertBookingRules(startAt, endAt);
    } catch (error) {
      return reply.status(400).send({
        ok: false,
        error: error instanceof Error ? error.message : "Invalid booking"
      });
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        id: { not: params.id },
        tableId: payload.tableId,
        status: "active",
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });

    if (overlapping) {
      return reply.status(409).send({ ok: false, error: "Этот стол уже занят в выбранное время" });
    }

    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: {
        tableId: payload.tableId,
        customGameTitle: payload.gameTitle,
        description: payload.description,
        startAt,
        endAt,
        participantsCount: payload.participantsCount,
        isPrivate: payload.isPrivate,
        openToJoin: !payload.isPrivate
      },
      include: { table: true, createdByMember: true, participants: { include: { member: true } } }
    });

    return serializeBooking(updated);
  });

  app.post("/:id/cancel", async (request, reply) => {
    const currentMember = await requireTelegramMember(request, reply);
    if (!currentMember) {
      return;
    }

    const params = bookingParamsSchema.parse(request.params);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    if (booking.createdByMember.telegramUserId?.toString() !== currentMember.telegramUserId?.toString()) {
      return reply.status(403).send({ ok: false, error: "Отменить бронь может только создатель" });
    }

    const cancelled = await prisma.booking.update({
      where: { id: params.id },
      data: { status: "cancelled" },
      include: { table: true, createdByMember: true, participants: { include: { member: true } } }
    });

    return serializeBooking(cancelled);
  });

  app.post("/:id/join", async (request, reply) => {
    const member = await requireTelegramMember(request, reply);
    if (!member) {
      return;
    }

    const params = bookingParamsSchema.parse(request.params);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    if (booking.status !== "active") {
      return reply.status(400).send({ ok: false, error: "Бронь уже неактивна" });
    }

    if (booking.isPrivate || !booking.openToJoin) {
      return reply.status(400).send({ ok: false, error: "К этой игре нельзя присоединиться" });
    }

    const alreadyJoined = booking.participants.find((participant) => participant.memberId === member.id);
    if (alreadyJoined) {
      return reply.status(400).send({ ok: false, error: "Вы уже присоединились к этой игре" });
    }

    const joinedPlayersCount = booking.participants.filter((participant) => participant.role !== "organizer").length;
    if (joinedPlayersCount >= booking.participantsCount) {
      return reply.status(409).send({ ok: false, error: "Свободных мест больше нет" });
    }

    await prisma.bookingParticipant.create({
      data: {
        bookingId: booking.id,
        memberId: member.id,
        role: "player"
      }
    });

    const updated = await findBookingWithRelations(params.id);
    if (!updated) {
      return reply.status(500).send({ ok: false, error: "Booking disappeared after join" });
    }

    return serializeBooking(updated);
  });

  app.post("/:id/leave", async (request, reply) => {
    const member = await requireTelegramMember(request, reply);
    if (!member) {
      return;
    }

    const params = bookingParamsSchema.parse(request.params);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    if (booking.status !== "active") {
      return reply.status(400).send({ ok: false, error: "Из неактивной брони нельзя выйти" });
    }

    if (booking.createdByMemberId === member.id) {
      return reply.status(400).send({ ok: false, error: "Организатор не может выйти из своей брони" });
    }

    const participant = booking.participants.find((item) => item.memberId === member.id);
    if (!participant) {
      return reply.status(400).send({ ok: false, error: "Вы не участвуете в этой игре" });
    }

    await prisma.bookingParticipant.delete({
      where: {
        bookingId_memberId: {
          bookingId: booking.id,
          memberId: member.id
        }
      }
    });

    const updated = await findBookingWithRelations(params.id);
    if (!updated) {
      return reply.status(500).send({ ok: false, error: "Booking disappeared after leave" });
    }

    return serializeBooking(updated);
  });

  app.delete("/:id/participants/:memberId", async (request, reply) => {
    const currentMember = await requireTelegramMember(request, reply);
    if (!currentMember) {
      return;
    }

    const params = bookingParticipantParamsSchema.parse(request.params);
    const booking = await findBookingWithRelations(params.id);

    if (!booking) {
      return reply.status(404).send({ ok: false, error: "Booking not found" });
    }

    if (booking.createdByMember.telegramUserId?.toString() !== currentMember.telegramUserId?.toString()) {
      return reply.status(403).send({ ok: false, error: "Изменять состав может только организатор" });
    }

    if (booking.createdByMemberId === params.memberId) {
      return reply.status(400).send({ ok: false, error: "Нельзя удалить организатора из брони" });
    }

    const participant = booking.participants.find((item) => item.memberId === params.memberId);
    if (!participant) {
      return reply.status(404).send({ ok: false, error: "Участник не найден в этой брони" });
    }

    await prisma.bookingParticipant.delete({
      where: {
        bookingId_memberId: {
          bookingId: booking.id,
          memberId: params.memberId
        }
      }
    });

    const updated = await findBookingWithRelations(params.id);
    if (!updated) {
      return reply.status(500).send({ ok: false, error: "Booking disappeared after participant removal" });
    }

    return serializeBooking(updated);
  });
};
