import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { renderRoutes } from "./routes/renderRoutes.js";
import { batchRoutes } from "./routes/batchRoutes.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
  bodyLimit: Number(process.env.BODY_LIMIT ?? 20_000_000),
});

await app.register(cors, {
  origin: true,
});

await app.register(multipart, {
  limits: {
    fileSize: Number(process.env.MAX_ZPL_BYTES ?? 20_000_000),
    files: Number(process.env.MAX_FILES ?? 2000),
  },
});

app.get("/", async () => {
  return {
    service: "Alquimia Studio API",
    status: "online",
    health: "/api/health"
  };
});

app.get("/api/health", async () => {
  return { ok: true };
});

await app.register(renderRoutes);
await app.register(batchRoutes);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });