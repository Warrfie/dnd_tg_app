import cors from "@fastify/cors";
import Fastify from "fastify";
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

  app.register(cors, {
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

  app.get("/health", async () => ({
    ok: true,
    service: "club-api"
  }));

  app.register(async (instance) => {
    instance.register(authRoutes, { prefix: "/auth" });
    instance.register(tableRoutes, { prefix: "/tables" });
    instance.register(bookingRoutes, { prefix: "/bookings" });
    instance.register(memberRoutes, { prefix: "/members" });
  }, { prefix: "/api" });

  return app;
}
