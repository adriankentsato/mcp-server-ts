export interface ServerConfig {
  port: number;
  host: string;
  baseUrl: string;
  logLevel: string;
  environment: string;
  authUsername: string;
  authPassword: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface Config {
  server: ServerConfig;
  databases: Record<string, DatabaseConfig>;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export function loadConfig(): Config {
  return {
    server: {
      port: getEnvNumber('PORT', 3001),
      host: getEnv('HOST', '0.0.0.0'),
      baseUrl: getEnv('BASE_URL', 'http://localhost:3001'),
      logLevel: getEnv('LOG_LEVEL', 'info'),
      environment: getEnv('NODE_ENV', 'development'),
      authUsername: getEnv('AUTH_USERNAME', 'admin'),
      authPassword: getEnv('AUTH_PASSWORD', 'changeme'),
    },
    databases: {
      postgresql: {
        host: getEnv('DB_PG_HOST', 'localhost'),
        port: getEnvNumber('DB_PG_PORT', 5432),
        database: getEnv('DB_PG_DATABASE', 'testdb'),
        username: getEnv('DB_PG_USERNAME', 'postgres'),
        password: getEnv('DB_PG_PASSWORD', 'postgres'),
      },
      mysql: {
        host: getEnv('DB_MYSQL_HOST', 'localhost'),
        port: getEnvNumber('DB_MYSQL_PORT', 3306),
        database: getEnv('DB_MYSQL_DATABASE', 'testdb'),
        username: getEnv('DB_MYSQL_USERNAME', 'root'),
        password: getEnv('DB_MYSQL_PASSWORD', 'root'),
      },
      mssql: {
        host: getEnv('DB_MSSQL_HOST', 'localhost'),
        port: getEnvNumber('DB_MSSQL_PORT', 1433),
        database: getEnv('DB_MSSQL_DATABASE', 'testdb'),
        username: getEnv('DB_MSSQL_USERNAME', 'sa'),
        password: getEnv('DB_MSSQL_PASSWORD', 'YourPassword123'),
      },
    },
  };
}

export const config = loadConfig();
