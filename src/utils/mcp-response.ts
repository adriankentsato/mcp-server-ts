export interface McpResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: any;
}

export class McpResponse extends Error {
  public result: McpResult;

  constructor(result: McpResult) {
    super();
    this.result = result;
    this.name = 'McpResponse';
  }
}

export class McpSuccessResponse extends McpResponse {
  constructor(data: any) {
    super({
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    });
    this.name = 'McpSuccessResponse';
  }
}

export class McpErrorResponse extends McpResponse {
  constructor(code: string, message: string) {
    super({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ code, message }, null, 2),
        },
      ],
      isError: true,
    });
    this.name = 'McpErrorResponse';
  }
}

export const NOT_FOUND = new McpErrorResponse('NOT_FOUND', 'Resource not found');
export const INVALID_PARAMS = new McpErrorResponse('INVALID_PARAMS', 'Invalid parameters');
export const INTERNAL_ERROR = new McpErrorResponse('INTERNAL_ERROR', 'Internal server error');
