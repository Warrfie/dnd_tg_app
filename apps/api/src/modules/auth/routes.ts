import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config.js";
import { validateTelegramInitData } from "./telegram-auth.js";

const authBodySchema = z.object({
  initData: z.string().min(1)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/telegram", async (request, reply) => {
    const body = authBodySchema.parse(request.body);
    const result = validateTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);

    if (!result.ok) {
      return reply.status(401).send(result);
    }

    return {
      ok: true,
      member: result.user
        ? {
            telegramUserId: result.user.id,
            firstName: result.user.first_name,
            lastName: result.user.last_name ?? null,
            username: result.user.username ?? null
          }
        : null
    };
  });
};
