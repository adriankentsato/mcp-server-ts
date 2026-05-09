import { FastifyRequest, FastifyReply } from 'fastify';
import { authStore } from './store';

declare module 'fastify' {
  interface FastifyRequest {
    tokenData?: { clientId: string };
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.header('WWW-Authenticate', 'Bearer realm="MCP Server"');
    reply.code(401).send({ error: 'unauthorized', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const tokenData = authStore.validateAccessToken(token);

  if (!tokenData) {
    reply.header('WWW-Authenticate', 'Bearer realm="MCP Server", error="invalid_token"');
    reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
    return;
  }

  request.tokenData = { clientId: tokenData.clientId };
}
