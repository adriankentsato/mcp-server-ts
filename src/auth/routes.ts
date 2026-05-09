import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authStore } from './store';
import { verifyCodeVerifier } from './pkce';
import { config } from '../utils/config';

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // OAuth Authorization Server Metadata
  fastify.get('/.well-known/oauth-authorization-server', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      issuer: config.server.baseUrl,
      authorization_endpoint: `${config.server.baseUrl}/authorize`,
      token_endpoint: `${config.server.baseUrl}/token`,
      registration_endpoint: `${config.server.baseUrl}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'password'],
      code_challenge_methods_supported: ['plain', 'S256'],
    };
  });

  // Dynamic Client Registration
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { redirect_uris?: string[] };
    const redirectUris = body.redirect_uris || [`${config.server.baseUrl}/callback`];
    const client = authStore.registerClient(redirectUris);
    return {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uris: client.redirectUris,
    };
  });

  // Authorization Endpoint (GET) - Show login page
  fastify.get('/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      response_type?: string;
      client_id?: string;
      redirect_uri?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      state?: string;
    };

    // Auto-register unknown clients for convenience
    if (query.client_id && !authStore.getClient(query.client_id)) {
      const client = authStore.registerClient([query.redirect_uri || `${config.server.baseUrl}/callback`]);
      query.client_id = client.clientId;
    }

    reply.type('text/html');
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Login - MCP Server</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
    form { display: flex; flex-direction: column; gap: 10px; }
    input { padding: 10px; font-size: 16px; }
    button { padding: 10px; font-size: 16px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h2>Login to MCP Server</h2>
  <form method="POST" action="/authorize/login">
    <input type="hidden" name="response_type" value="${query.response_type || 'code'}">
    <input type="hidden" name="client_id" value="${query.client_id || ''}">
    <input type="hidden" name="redirect_uri" value="${query.redirect_uri || ''}">
    <input type="hidden" name="code_challenge" value="${query.code_challenge || ''}">
    <input type="hidden" name="code_challenge_method" value="${query.code_challenge_method || ''}">
    <input type="hidden" name="state" value="${query.state || ''}">
    <input type="text" name="username" placeholder="Username" required>
    <input type="password" name="password" placeholder="Password" required>
    <button type="submit">Login</button>
  </form>
</body>
</html>
    `;
  });

  // Authorization Endpoint (POST) - Process login
  fastify.post('/authorize/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      username?: string;
      password?: string;
      response_type?: string;
      client_id?: string;
      redirect_uri?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      state?: string;
    };

    if (body.username !== config.server.authUsername || body.password !== config.server.authPassword) {
      reply.type('text/html');
      return `
<!DOCTYPE html>
<html>
<head>
  <title>Login Failed</title>
</head>
<body>
  <h2>Login Failed</h2>
  <p>Invalid username or password.</p>
  <a href="/authorize?response_type=${body.response_type || 'code'}&client_id=${body.client_id || ''}&redirect_uri=${encodeURIComponent(body.redirect_uri || '')}&code_challenge=${body.code_challenge || ''}&code_challenge_method=${body.code_challenge_method || ''}&state=${body.state || ''}">Try again</a>
</body>
</html>
      `;
    }

    const code = authStore.createAuthCode(
      body.code_challenge || '',
      body.code_challenge_method || 'plain',
      body.redirect_uri || '',
      body.client_id || ''
    );

    const redirectUrl = new URL(body.redirect_uri || `${config.server.baseUrl}/callback`);
    redirectUrl.searchParams.set('code', code);
    if (body.state) {
      redirectUrl.searchParams.set('state', body.state);
    }

    reply.redirect(redirectUrl.toString());
  });

  // Token Endpoint
  fastify.post('/token', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      grant_type?: string;
      code?: string;
      code_verifier?: string;
      redirect_uri?: string;
      client_id?: string;
      username?: string;
      password?: string;
    };

    if (body.grant_type === 'authorization_code') {
      const authCode = authStore.consumeAuthCode(body.code || '');
      if (!authCode) {
        reply.code(400).send({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
        return;
      }

      if (authCode.codeChallenge) {
        const valid = verifyCodeVerifier(
          body.code_verifier || '',
          authCode.codeChallenge,
          authCode.codeChallengeMethod
        );
        if (!valid) {
          reply.code(400).send({ error: 'invalid_grant', error_description: 'Invalid code verifier' });
          return;
        }
      }

      const accessToken = authStore.createAccessToken(authCode.clientId);
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
      };
    }

    if (body.grant_type === 'password') {
      if (body.username !== config.server.authUsername || body.password !== config.server.authPassword) {
        reply.code(400).send({ error: 'invalid_grant', error_description: 'Invalid username or password' });
        return;
      }

      const clientId = body.client_id || 'default';
      const accessToken = authStore.createAccessToken(clientId);
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
      };
    }

    reply.code(400).send({ error: 'unsupported_grant_type', error_description: 'Grant type not supported' });
  });
}
