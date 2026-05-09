import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import staticFiles from '@fastify/static';
import { join } from 'path';
import { config } from './utils/config';
import { registerAuthRoutes } from './auth/routes';
import { registerMcpRoutes } from './mcp/routes';
import { database } from './utils/db';
import { authStore } from './auth/store';

async function build() {
  const fastify = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  });

  await fastify.register(cors, {
    origin: '*',
  });

  await fastify.register(formbody);

  await fastify.register(staticFiles, {
    root: join(process.cwd(), 'frontend'),
    prefix: '/debugger/',
  });

  await registerAuthRoutes(fastify);
  await registerMcpRoutes(fastify);

  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  setInterval(() => {
    authStore.cleanupExpired();
  }, 5 * 60 * 1000);

  return fastify;
}

async function start(): Promise<void> {
  const fastify = await build();

  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    await database.releaseAllConnections();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });
    fastify.log.info(`Server listening on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { build };
