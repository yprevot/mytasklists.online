import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from './entities';
import { InitialSchema1710000000000 } from './migrations/1710000000000-InitialSchema';

export const buildDataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'postgres',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'lista',
  password: process.env.POSTGRES_PASSWORD ?? 'lista_dev_password',
  database: process.env.POSTGRES_DB ?? 'listadecompras',
  entities: Object.values(entities).filter((value) => typeof value === 'function') as any[],
  migrations: [InitialSchema1710000000000],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true' ? 'all' : ['error', 'warn'],
});

/** DataSource usado por la CLI de TypeORM y por los seeds */
export default new DataSource(buildDataSourceOptions());
