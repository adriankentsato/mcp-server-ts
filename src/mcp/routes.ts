import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './index';
import { authMiddleware } from '../auth/middleware';

interface SessionData {
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, SessionData>();

export async function registerMcpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/mcp',
    { preHandler: authMiddleware, bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        transport = session.transport;
      } else if (!sessionId) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sessions.set(sid, { transport: transport! });
          },
        });

        transport.onclose = () => {
          const sid = transport!.sessionId;
          if (sid) sessions.delete(sid);
        };

        const mcpServer = createMcpServer();
        await mcpServer.connect(transport);
      } else {
        return reply.status(404).send({
          error: 'session_not_found',
          error_description: 'Unknown Mcp-Session-Id. Omit the header to start a new session.',
        });
      }

      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
    }
  );

  fastify.get(
    '/mcp',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        return reply.status(404).send({
          error: 'session_not_found',
          error_description: 'Mcp-Session-Id header is required and must belong to an active session.',
        });
      }

      const { transport } = sessions.get(sessionId)!;
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw);
    }
  );

  fastify.delete(
    '/mcp',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        return reply.status(404).send({ error: 'session_not_found' });
      }

      const { transport } = sessions.get(sessionId)!;
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw);
      sessions.delete(sessionId);
    }
  );
}
