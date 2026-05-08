import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "./config.js";
import { authRoutes } from "./modules/auth/routes.js";
import { bookingRoutes } from "./modules/bookings/routes.js";
import { memberRoutes } from "./modules/members/routes.js";
import { tableRoutes } from "./modules/tables/routes.js";

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  const allowedOrigins = new Set([
    env.WEB_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ]);

  return allowedOrigins.has(origin);
}

export function buildServer() {
  const app = Fastify({ logger: true });
  const staticRoot = env.STATIC_ROOT ? resolve(env.STATIC_ROOT) : null;

  app.get("/health", async () => ({
    ok: true,
    service: "club-api"
  }));

  app.register(async (instance) => {
    instance.register(cors, {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin ?? "unknown"} is not allowed by CORS`), false);
      },
      methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true
    });

    instance.register(authRoutes, { prefix: "/auth" });
    instance.register(tableRoutes, { prefix: "/tables" });
    instance.register(bookingRoutes, { prefix: "/bookings" });
    instance.register(memberRoutes, { prefix: "/members" });
  }, { prefix: "/api" });

  if (staticRoot && existsSync(staticRoot)) {
    app.register(staticPlugin, {
      root: staticRoot,
      prefix: "/"
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api")) {
        reply.status(404).send({ ok: false, error: "Route not found" });
        return;
      }

      reply.type("text/html").sendFile("index.html");
    });
  }

  return app;
}
