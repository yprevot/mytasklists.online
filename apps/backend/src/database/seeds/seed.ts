/* Ejecuta el seed desde la linea de comandos: `node dist/database/seeds/seed.js` */
import 'reflect-metadata';
import dataSource from '../data-source';
import { runSeed } from './seed-data';

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const summary = await runSeed(dataSource);
    // eslint-disable-next-line no-console
    console.log(`[seed] ${summary}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[seed] error:', error);
  process.exit(1);
});
