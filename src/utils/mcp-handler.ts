import { McpResponse, McpResult } from './mcp-response';

export type McpMiddleware<TArgs, TCtx> = (args: TArgs, ctx: TCtx) => Promise<void | McpResponse>;

export function McpHandler<TArgs, TCtx>(...handlers: McpMiddleware<TArgs, TCtx>[]) {
  return async (args: TArgs, ctx: TCtx): Promise<McpResult> => {
    for (const handler of handlers) {
      try {
        const result = await handler(args, ctx);
        if (result instanceof McpResponse) {
          return result.result;
        }
      } catch (error) {
        if (error instanceof McpResponse) {
          return error.result;
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ code: 'NOT_FOUND', message: 'No handler returned a response' }, null, 2),
        },
      ],
      isError: true,
    };
  };
}
