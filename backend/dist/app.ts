import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { renderRoutes } from './routes/renderRoutes.js';
import { batchRoutes } from './routes/batchRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    bodyLimit: Number(process.env.BODY_LIMIT ?? 20_000_000),
  });

  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  const HOST = process.env.HOST ?? '0.0.0.0';

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.MAX_ZPL_BYTES ?? 20_000_000),
      files: Number(process.env.MAX_FILES ?? 2000),
    },
  });

  // API routes
  await app.register(renderRoutes);
  await app.register(batchRoutes);

  // Healthcheck
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Serve frontend build (only after API routes)
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../../frontend/dist'),
    prefix: '/',
    wildcard: false,
    decorateReply: false,
    index: ['index.html']
  });

  // SPA fallback (não quebrar /api)
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url && request.raw.url.startsWith('/api')) {
      reply.status(404).send({ error: 'Not found' });
    } else {
      reply.type('text/html').sendFile('index.html');
    }
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
