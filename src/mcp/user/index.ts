import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getUserHandler } from './get';

export const userTools: Tool[] = [
  {
    name: 'get_user',
    description: 'Retrieve a user by email from database',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to look up',
        },
        portal: {
          type: 'string',
          description: 'Database alias to query (default: postgresql)',
        },
      },
      required: ['email'],
    },
  },
];

export const userToolHandlers = {
  get_user: getUserHandler,
};
