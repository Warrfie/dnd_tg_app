import { FastifyReply, FastifyRequest } from "fastify";
import { Member } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { env } from "../../config.js";
import { validateTelegramInitData } from "./telegram-auth.js";

export const telegramInitDataHeader = "x-telegram-init-data";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

async function findMatchingMember(user: TelegramUser) {
  const telegramUserId = BigInt(user.id);
  const byTelegramId = await prisma.member.findUnique({ where: { telegramUserId } });

  if (byTelegramId) {
    return byTelegramId;
  }

  if (user.username) {
    const byUsername = await prisma.member.findFirst({
      where: { username: user.username }
    });

    if (byUsername) {
      return byUsername;
    }
  }

  return prisma.member.findFirst({
    where: {
      firstName: user.first_name,
      telegramUserId: null
    }
  });
}

export async function upsertTelegramMember(user: TelegramUser) {
  const existing = await findMatchingMember(user);
  const data = {
    telegramUserId: BigInt(user.id),
    username: user.username ?? null,
    firstName: user.first_name,
    lastName: user.last_name ?? null
  };

  if (existing) {
    return prisma.member.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.member.create({ data });
}

export async function resolveTelegramMember(initData: string) {
  const result = validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);

  if (!result.ok) {
    return { ok: false as const, error: result.reason };
  }

  if (!result.user) {
    return { ok: false as const, error: "Telegram user is missing" };
  }

  const member = await upsertTelegramMember(result.user);
  return { ok: true as const, member };
}

export async function requireTelegramMember(request: FastifyRequest, reply: FastifyReply): Promise<Member | null> {
  const initData = request.headers[telegramInitDataHeader];

  if (typeof initData !== "string" || !initData.trim()) {
    await reply.status(401).send({ ok: false, error: "Telegram auth is required" });
    return null;
  }

  const result = await resolveTelegramMember(initData);
  if (!result.ok) {
    await reply.status(401).send({ ok: false, error: result.error });
    return null;
  }

  return result.member;
}
