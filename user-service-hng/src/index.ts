import fastify, { FastifyInstance } from "fastify";
import dotenv from "dotenv";
import { AuthRoutes } from "./routes/auth-routes";
import { UserRoutes } from "./routes/user-routes";
import jwt from "jsonwebtoken";
import { PrismaClient } from "./generated/prisma/client";
dotenv.config();
export const prisma = new PrismaClient();
export const app = fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});
const port = process.env.PORT! ? parseInt(process.env.PORT) : 8000;

export const routes = (app: FastifyInstance) => {
  app.register(AuthRoutes, { prefix: "/auth" });
  app.register(UserRoutes, { prefix: "/users" });
  app.get("/health", async (request, reply) => {
    const status: any = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    if (!process.env.DATABASE_URL) {
      status.db = "not configured";
      return reply.code(200).send({ ...status });
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      status.db = "ok";
      return reply.code(200).send(status);
    } catch (err: any) {
      status.db = "unreachable";
      status.error = String(err?.message ?? err);
      return reply.code(503).send({ ...status, status: "error" });
    }
  });
};
app.register(routes, { prefix: "/api/v1" });

// Only start the server when this file is executed directly.
// This allows importing the app (for tests) without binding to a port.
if (require.main === module) {
  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
