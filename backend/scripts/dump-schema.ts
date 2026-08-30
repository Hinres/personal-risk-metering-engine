import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/config/database';

async function main() {
  const dbPath = '/tmp/prme-schema-dump.sqlite';
  const fs = require('fs');
  try { fs.unlinkSync(dbPath); } catch {}

  const tempDs = new DataSource({
    ...(AppDataSource.options as any),
    database: dbPath,
    synchronize: true,
    migrations: [],
    migrationsRun: false,
    logging: false,
  });

  await tempDs.initialize();

  const tables = await tempDs.query(`SELECT name, sql FROM sqlite_master WHERE type='table'`);
  const indexes = await tempDs.query(`SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL`);

  console.log('--- TABLES ---');
  for (const t of tables) {
    console.log(`-- ${t.name}`);
    console.log(`${t.sql};`);
  }
  console.log('--- INDEXES ---');
  for (const i of indexes) {
    console.log(`${i.sql};`);
  }

  await tempDs.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
