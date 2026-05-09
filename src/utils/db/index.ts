import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import { DatabaseFactory, factories } from './factories';
import { config } from '../config';

interface DatabaseKey {
  factoryType: string;
  connectionString: string;
}

class Database {
  private dataSources: Map<string, DataSource> = new Map();
  private queue: Map<string, Promise<DataSource>> = new Map();

  private getKey(factoryType: string, connectionString: string): string {
    return `${factoryType}:${connectionString}`;
  }

  async getConnection(factoryType: string, connectionString: string): Promise<QueryRunner> {
    const key = this.getKey(factoryType, connectionString);

    if (this.dataSources.has(key)) {
      const dataSource = this.dataSources.get(key)!;
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      return queryRunner;
    }

    if (this.queue.has(key)) {
      const dataSource = await this.queue.get(key)!;
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      return queryRunner;
    }

    const factory = factories[factoryType];
    if (!factory) {
      throw new Error(`Unknown database factory type: ${factoryType}`);
    }

    const initPromise = (async () => {
      try {
        const options = factory.dsFactory(connectionString);
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        await factory.testFn(dataSource);
        this.dataSources.set(key, dataSource);
        this.queue.delete(key);
        return dataSource;
      } catch (error) {
        this.queue.delete(key);
        throw error;
      }
    })();

    this.queue.set(key, initPromise);

    const dataSource = await initPromise;
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    return queryRunner;
  }

  async getConnectionByAlias(alias: string): Promise<QueryRunner> {
    const dbConfig = config.databases[alias];
    if (!dbConfig) {
      throw new Error(`Unknown database alias: ${alias}`);
    }

    const connectionString = this.buildConnectionString(alias, dbConfig);
    return this.getConnection(alias, connectionString);
  }

  private buildConnectionString(type: string, config: any): string {
    switch (type) {
      case 'postgresql':
        return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
      case 'mysql':
        return `mysql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
      case 'mssql':
        return `mssql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  async releaseAllConnections(): Promise<void> {
    const promises = Array.from(this.dataSources.values()).map((ds) => ds.destroy());
    await Promise.all(promises);
    this.dataSources.clear();
    this.queue.clear();
  }
}

export const database = new Database();
