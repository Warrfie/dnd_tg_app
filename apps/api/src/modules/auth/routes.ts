import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolveTelegramMember } from "./current-member.js";

const authBodySchema = z.object({
  initData: z.string().min(1)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/telegram", async (request, reply) => {
    const body = authBodySchema.parse(request.body);
    const result = await resolveTelegramMember(body.initData);

    if (!result.ok) {
      return reply.status(401).send({ ok: false, error: result.error });
    }

    return {
      ok: true,
      member: {
        id: result.member.id,
        telegramUserId: result.member.telegramUserId?.toString() ?? null,
        firstName: result.member.firstName,
        lastName: result.member.lastName ?? null,
        username: result.member.username ?? null,
        isAdmin: result.member.isAdmin
      }
    };
  });
};
