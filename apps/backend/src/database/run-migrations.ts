import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source';

/** Admin credentials exist only in the short-lived migration container. */
async function main() {
  const db = new DataSource({ ...buildDataSourceOptions(), logging: false });
  await db.initialize();
  try {
    await db.runMigrations();
    const role = process.env.APP_DB_USER;
    const password = process.env.APP_DB_PASSWORD;
    if (!role || !/^[a-z][a-z0-9_]{2,40}$/.test(role) || !password || password.length < 32)
      throw new Error('APP_DB_USER y APP_DB_PASSWORD deben estar configurados');
    const identifier = `"${role}"`;
    const literal = `'${password.replace(/'/g, "''")}'`;
    const [exists] = await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    if (!exists) await db.query(`CREATE ROLE ${identifier} LOGIN`);
    await db.query(`ALTER ROLE ${identifier} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal}`);
    const database = `"${(process.env.POSTGRES_DB || 'mytasklists').replace(/"/g, '""')}"`;
    await db.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      REVOKE ALL ON DATABASE ${database} FROM ${identifier};
      GRANT CONNECT ON DATABASE ${database} TO ${identifier};
      GRANT USAGE ON SCHEMA public TO ${identifier};
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${identifier};
      GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${identifier};
      REVOKE ALL ON TABLE migrations FROM ${identifier};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${identifier};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO ${identifier};`);
    console.log('Migraciones y permisos de aplicación verificados');
  } finally { await db.destroy(); }
}
main().catch(() => { console.error('Falló la migración o la configuración del rol de aplicación'); process.exitCode=1; });
