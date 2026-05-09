import { McpHandler } from '../../utils/mcp-handler';
import { McpSuccessResponse, McpErrorResponse, INVALID_PARAMS, NOT_FOUND } from '../../utils/mcp-response';
import { database } from '../../utils/db';

export interface GetUserArgs {
  email: string;
  portal?: string;
}

export interface GetUserContext {
  connection: any;
}

export const getUserHandler = McpHandler<GetUserArgs, GetUserContext>(
  async ({ email }, ctx) => {
    if (!email) {
      throw INVALID_PARAMS;
    }
  },
  async ({ portal }, ctx) => {
    const dbAlias = portal || 'postgresql';
    ctx.connection = await database.getConnectionByAlias(dbAlias);
  },
  async ({ email }, ctx) => {
    const result = await ctx.connection.query(
      'SELECT email, first_name, last_name, full_name, title FROM users WHERE email = ?',
      [email]
    );

    if (!result || result.length === 0) {
      throw NOT_FOUND;
    }

    throw new McpSuccessResponse(result[0]);
  }
);
