import { DataSource, DataSourceOptions } from 'typeorm';

export interface DatabaseFactory {
  context: string;
  dsFactory: (connectionString: string) => DataSourceOptions;
  testFn: (dataSource: DataSource) => Promise<void>;
}

export const postgresFactory: DatabaseFactory = {
  context: 'PostgreSQL',
  dsFactory: (connectionString: string): DataSourceOptions => ({
    type: 'postgres',
    url: connectionString,
    poolSize: 100,
    logging: false,
  } as DataSourceOptions),
  testFn: async (dataSource: DataSource) => {
    await dataSource.query('SELECT 1');
  },
};

export const mysqlFactory: DatabaseFactory = {
  context: 'MySQL',
  dsFactory: (connectionString: string): DataSourceOptions => ({
    type: 'mysql',
    url: connectionString,
    poolSize: 100,
    ssl: { rejectUnauthorized: false },
    logging: false,
  } as DataSourceOptions),
  testFn: async (dataSource: DataSource) => {
    await dataSource.query('SELECT 1');
  },
};

export const mssqlFactory: DatabaseFactory = {
  context: 'MSSQL',
  dsFactory: (connectionString: string): DataSourceOptions => ({
    type: 'mssql',
    url: connectionString,
    extra: {
      requestTimeout: 30000,
      options: { encrypt: true },
      pool: { max: 100 },
    },
    logging: false,
  } as DataSourceOptions),
  testFn: async (dataSource: DataSource) => {
    await dataSource.query('SELECT 1');
  },
};

export const factories: Record<string, DatabaseFactory> = {
  postgresql: postgresFactory,
  mysql: mysqlFactory,
  mssql: mssqlFactory,
};
