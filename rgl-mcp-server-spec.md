# My MCP Server Implementation Specification

## Overview

A remote MCP (Model Context Protocol) server with OAuth 2.0 Authorization Code flow secured with PKCE. Provides MCP tools to clients via HTTP with SSE notifications.

## Architecture Flow

```
MCP Client
  │
  │  1. POST /mcp  (no token)
  ▼
Server
  │  → 401 + WWW-Authenticate: Bearer realm=...
  │
  │  2. GET /.well-known/oauth-authorization-server
  │  → discovers /authorize and /token endpoints
  │
  │  3. Redirect browser → GET /authorize?response_type=code&...
  │  → renders login page
  │
  │  4. User submits credentials
  │  → POST /authorize/login → issues auth code → redirects to client
  │
  │  5. Client exchanges code
  │  → POST /token → returns access_token
  │
  │  6. POST /mcp  (Bearer <token>)
  ▼
MCP session established
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/.well-known/oauth-authorization-server` | OAuth server metadata |
| `POST` | `/register` | Dynamic client registration |
| `GET`  | `/authorize` | Show login page |
| `POST` | `/authorize/login` | Process credentials, issue auth code |
| `POST` | `/token` | Exchange auth code for access token |
| `POST` | `/mcp` | MCP — initialize session or send message |
| `GET`  | `/mcp` | MCP — open SSE notification stream |
| `DELETE` | `/mcp` | MCP — terminate session |
| `GET`  | `/debugger/debugger.html` | Web-based MCP debugger |
| `GET`  | `/health` | Health check |

## Directory Structure

```
src/
  auth/
    __tests__/           # Authentication test suite
    middleware.ts        # Bearer token validation middleware
    pkce.ts              # PKCE code verifier/challenge utilities
    routes.ts            # OAuth endpoints
    store.ts             # In-memory token/code/client storage
  mcp/
    index.ts             # MCP server setup and tool registration
    routes.ts            # MCP HTTP endpoints with StreamableHTTPServerTransport
    user/                # User-related MCP tools
      get.ts             # get_user tool implementation
      index.ts           # User tools registration
  utils/
    db/                  # Database utilities
      factories.ts       # Database factory configurations
      index.ts           # Database connection management with connection pooling
    config.ts            # Environment configuration
    mcp-handler.ts       # MCP middleware chain handler
    mcp-response.ts      # MCP response wrapper classes
  interfaces/
    result.ts            # Common result type definitions
  server.ts              # Server entry point
```

## Components

### Server Entry Point

The main server initialization file that:
- Configures the HTTP server with logging
- Registers CORS middleware allowing MCP clients from any origin
- Registers form body parsing for login submissions
- Serves static files for the debugger interface
- Registers OAuth routes and MCP routes
- Provides health check endpoint

### Authentication System

#### OAuth Routes

Implements the following OAuth 2.0 endpoints:

1. **OAuth Authorization Server Metadata** — Returns OAuth server configuration including authorization endpoint, token endpoint, registration endpoint, supported response types, grant types, and PKCE methods.

2. **Dynamic Client Registration** — Allows clients to register with redirect URIs, returns client credentials.

3. **Authorization Endpoint (GET)** — Displays a built-in login form when users access via browser. Auto-registers unknown clients for MCP tooling convenience.

4. **Authorization Endpoint (POST)** — Processes login credentials. On successful authentication, generates authorization code with PKCE support and redirects to client.

5. **Token Endpoint** — Supports two grant types:
   - `authorization_code` — Standard OAuth flow with PKCE verification
   - `password` — Direct authentication for development/debugging

Returns access tokens with Bearer type and expiration.

#### Authentication Middleware

Pre-handler middleware for protected routes:
- Extracts Bearer token from Authorization header
- Validates token against in-memory store
- Attaches token data to request for downstream use
- Returns 401 with WWW-Authenticate header on failure

#### PKCE Utilities

Implements PKCE code challenge verification:
- Supports `S256` method (SHA-256 hash with base64url encoding)
- Supports `plain` method (direct comparison)
- Validates code_verifier against stored code_challenge

#### Authentication Store

In-memory storage for OAuth data:
- **Authorization codes** — 10-minute expiration, single-use
- **Access tokens** — 1-hour expiration
- **Clients** — Registered OAuth clients

Token and code generation using cryptographically secure random bytes.

### MCP Implementation

#### MCP Routes with StreamableHTTPServerTransport

The MCP endpoint implementation using `StreamableHTTPServerTransport`:

**POST /mcp**
- Accepts MCP messages (JSON-RPC 2.0)
- Body limit: 10MB for large MCP payloads
- Protected by authentication middleware
- Session handling:
  - If `Mcp-Session-Id` header present and valid → use existing session
  - If no header → create new session with new transport
  - If invalid session ID → return 404 error
- Transport initialization:
  - Creates `StreamableHTTPServerTransport` with UUID session generator
  - On session initialization, stores transport in session map
  - On transport close, removes session from map
- Response handling via `hijack()` to let transport control the response

**GET /mcp**
- Opens SSE notification stream for existing sessions
- Requires valid `Mcp-Session-Id` header
- Uses transport's SSE capability for real-time notifications

**DELETE /mcp**
- Terminates active session
- Requires valid `Mcp-Session-Id` header
- Cleans up session from memory

#### MCP Server Setup

Factory function that creates and configures an MCP server instance:
- Sets server name and version metadata
- Registers built-in tools (ping, echo, server_info)
- Registers domain-specific tools (user tools)
- Each new session gets a fresh server instance

#### User Tools

Tools for user management operations:

**get_user Tool**
- Retrieves user by email from database
- Parameters:
  - `email` (required) — Email address to look up
  - `portal` (optional) — Database alias to query, supports multiple aliases per database
- Uses middleware chain pattern for database connection handling
- Queries users table for email, first name, last name, full name, title
- Returns user data or NOT_FOUND error

### Utilities

#### MCP Handler (mcp-handler.ts)

Middleware chain handler for MCP tool implementations.

**Purpose**: Enables composing tool logic from multiple reusable middleware functions that share a context object.

**How it works**:
- `McpHandler<TArgs, TCtx>(...handlers)` — Creates a handler function
- Each middleware receives `(args, ctx)` where `ctx` is a shared mutable object
- Middleware can:
  - Return `void` to pass control to next handler
  - Throw or return `McpResponse` to stop chain and send response
- All errors caught and converted to MCP error responses
- If no handler returns response, throws NOT_FOUND error

**Example usage**:
```
McpHandler<{ email: string }, { connection: DatabaseConnection }>(
  async ({ email }, ctx) => {
    // Establish database connection
    ctx.connection = await getConnection();
  },
  async ({ email }, ctx) => {
    // Use connection from context to query data
    const result = await ctx.connection.query('SELECT ...', [email]);
    return new McpSuccessResponse(result);
  }
)
```

#### MCP Response (mcp-response.ts)

Response wrapper classes for MCP tool handlers.

**McpResponse (base class)**
- Extends Error for throw-based control flow
- Contains `result` property with MCP result structure

**McpSuccessResponse**
- Creates successful MCP response
- Wraps data as JSON in text content block

**McpErrorResponse**
- Creates error MCP response
- Takes error code and message
- Sets `isError: true` flag
- Wraps code/message as JSON in text content block

**McpResult type**:
```
{
  content: Array<{ type: 'text', text: string }>,
  isError?: boolean
}
```

#### Database Utilities (utils/db/)

**Database Class (index.ts)**

Connection pooling and management system:
- Uses a queue-based system for managing connection pool creation
- Maintains map of DataSource instances keyed by factory type + connection string
- Lazy initialization: creates pool on first request, reuses thereafter
- Provides `getConnection()` method that returns a QueryRunner
- Connection test query validates pool health before returning
- `releaseAllConnections()` for graceful shutdown

**Database Factories (factories.ts)**

Factory configurations for different database types:
- **PostgreSQL** — Pool size 100, `SELECT 1` health check
- **MySQL** — Pool size 100, SSL with rejectUnauthorized: false, `SELECT 1` health check  
- **MSSQL** — Max pool 100 via extra config, `SELECT 1` health check

Each factory provides:
- `context` — Logging prefix
- `dsFactory` — DataSource creation function from connection string
- `testFn` — Connection validation query

**Configuration**

Connection strings built from environment-provided credentials:
- Host, port, database name, username, password
- Format: `postgresql://user:password@host:port/database`
- Supports multiple named database configurations

### Configuration

Environment-based configuration for:
- Server: port, host, base URL, log level, environment
- Database: Multiple named database connection settings

## Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `ping` | Health check — returns pong | None |
| `echo` | Echo back a message | `message` (string) — The message to echo |
| `server_info` | Returns server metadata | None |
| `get_user` | Retrieve a user by email from database | `email` (string, required), `portal` (string, default) — Database alias |

## Tool Response Content Types

Tool handlers return `{ content: ContentBlock[] }`. Supported block types:

| Type | Required Fields | Description |
|------|----------------|-------------|
| `text` | `text: string` | Plain or markdown text |
| `image` | `data: string` (base64), `mimeType: string` | Base64-encoded image |
| `audio` | `data: string` (base64), `mimeType: string` | Base64-encoded audio |
| `resource` | `resource: { uri, text } \| { uri, blob }` | Embedded resource |
| `resource_link` | `uri: string`, `name: string` | Reference to external resource |

## Debugger Interface

Web-based debugger at `/debugger/debugger.html`:
- OAuth authentication flow via password grant
- MCP session initialization and management
- List and inspect available tools
- Execute tools with custom JSON arguments
- Real-time activity log showing requests/responses

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Listen port |
| `HOST` | `0.0.0.0` | Listen host |
| `BASE_URL` | `http://localhost:3001` | Public base URL for OAuth metadata |
| `LOG_LEVEL` | `info` | Log level |
| `NODE_ENV` | `development` | Environment mode |
| `AUTH_USERNAME` | `admin` | Login username |
| `AUTH_PASSWORD` | `changeme` | Login password |

## Security Considerations

- Tokens stored in memory — sessions lost on restart
- In-memory stores should be replaced with persistent storage for production
- HTTPS required in production
- Single-user credential model for internal tooling
- PKCE required for authorization code flow
- Bearer token validation on all MCP endpoints

## Adding MCP Tools

Register tools in the MCP server setup:

1. Define tool name, title, description
2. Define input schema with validation rules
3. Implement handler function returning content blocks
4. Use `McpHandler` for middleware chain if needed
5. Use `McpSuccessResponse` or `McpErrorResponse` for responses

## Build Commands

| Command | Description |
|---------|-------------|
| `build` | Compile source to distribution directory |
| `watch` | Watch mode compilation |
| `dev` | Development with auto-restart |
| `start` | Run compiled server |
| `test` | Run test suite |
| `test:coverage` | Coverage report |
| `lint` | Static analysis |
| `lint:fix` | Auto-fix issues |

## MCP Client Configuration

Example client configuration for streamable-http transport:

```json
{
  "mcpServers": {
    "my-mcp": {
      "type": "streamable-http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Client automatically handles OAuth redirect when token missing or expired.
