# My MCP Server

A remote MCP (Model Context Protocol) server with OAuth 2.0 Authorization Code flow secured with PKCE. Provides MCP tools to clients via HTTP with SSE notifications.

## Features

- **OAuth 2.0 Authentication** — Authorization Code flow with PKCE support
- **Dynamic Client Registration** — Auto-registration for MCP tooling convenience
- **Streamable HTTP Transport** — Modern MCP protocol over HTTP with SSE
- **Multi-Database Support** — PostgreSQL, MySQL, and MSSQL via TypeORM
- **Web Debugger** — Built-in browser-based MCP debugging interface
- **Health Monitoring** — Health check endpoint for monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.sample .env.development
# Edit .env.development with your settings

# Run in development mode
npm run dev

# Build for production
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Listen port |
| `HOST` | `0.0.0.0` | Listen host |
| `BASE_URL` | `http://localhost:3001` | Public base URL for OAuth metadata |
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |
| `NODE_ENV` | `development` | Environment mode |
| `AUTH_USERNAME` | `admin` | Login username |
| `AUTH_PASSWORD` | `changeme` | Login password |
| `DB_*` | — | Database connection settings (see `.env.sample`) |

## Authentication Flow

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/oauth-authorization-server` | OAuth server metadata |
| `POST` | `/register` | Dynamic client registration |
| `GET` | `/authorize` | Show login page |
| `POST` | `/authorize/login` | Process credentials, issue auth code |
| `POST` | `/token` | Exchange auth code for access token |
| `POST` | `/mcp` | MCP — initialize session or send message |
| `GET` | `/mcp` | MCP — open SSE notification stream |
| `DELETE` | `/mcp` | MCP — terminate session |
| `GET` | `/debugger/debugger.html` | Web-based MCP debugger |
| `GET` | `/health` | Health check endpoint |

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `ping` | Health check — returns "pong" | None |
| `echo` | Echo back a message | `message` (string) |
| `server_info` | Returns server metadata | None |
| `get_user` | Retrieve user by email from database | `email` (string, required), `portal` (string, optional) |

## MCP Client Configuration

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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode compilation |
| `npm run dev` | Development with auto-restart (tsx) |
| `npm start` | Run compiled server |
| `npm test` | Run test suite (Vitest) |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |

## Project Structure

```
src/
  auth/              # OAuth 2.0 authentication
    middleware.ts    # Bearer token validation
    pkce.ts          # PKCE utilities
    routes.ts        # OAuth endpoints
    store.ts         # In-memory token storage
  mcp/               # MCP implementation
    index.ts         # MCP server setup
    routes.ts        # MCP HTTP endpoints
    user/            # User-related MCP tools
  utils/             # Utilities
    db/              # Database connection pooling
    config.ts        # Environment configuration
    mcp-handler.ts   # MCP middleware chain handler
    mcp-response.ts  # MCP response wrappers
  interfaces/          # Type definitions
    result.ts
  server.ts          # Entry point
frontend/            # Web debugger interface
  debugger.html
```

## Security

- Tokens stored in memory — sessions lost on server restart
- PKCE required for authorization code flow
- Bearer token validation on all MCP endpoints
- HTTPS required in production
- In-memory stores should be replaced with persistent storage for production use

## License

MIT
