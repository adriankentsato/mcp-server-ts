import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { userTools, userToolHandlers } from './user';
import type { GetUserContext } from './user/get';
import { z } from 'zod';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0',
  });

  // Register built-in tools using registerTool with Zod schemas
  server.registerTool('ping', {
    description: 'Health check - returns pong',
    inputSchema: z.object({}),
  }, async (_args: any) => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ message: 'pong' }, null, 2),
        },
      ],
    };
  });

  server.registerTool('echo', {
    description: 'Echo back a message',
    inputSchema: z.object({
      message: z.string().describe('The message to echo'),
    }),
  }, async (args: any) => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ message: args.message }, null, 2),
        },
      ],
    };
  });

  server.registerTool('server_info', {
    description: 'Returns server metadata',
    inputSchema: z.object({}),
  }, async (_args: any) => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: 'my-mcp-server',
              version: '1.0.0',
              capabilities: ['tools'],
            },
            null,
            2
          ),
        },
      ],
    };
  });

  // Register user tools
  for (const tool of userTools) {
    if (tool.name === 'get_user' && userToolHandlers.get_user) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: z.object({
          email: z.string(),
          portal: z.string().optional(),
        }),
      }, async (args: any) => {
        const ctx: GetUserContext = {} as GetUserContext;
        return await userToolHandlers.get_user(args, ctx);
      });
    }
  }

  return server;
}
