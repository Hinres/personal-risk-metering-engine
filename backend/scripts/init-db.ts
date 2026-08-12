import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/database.sqlite');
const INIT_SQL_PATH = path.resolve(__dirname, '../../database/init.sql');

function openDb(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function execSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getTables(db: sqlite3.Database): Promise<string[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map((r) => r.name));
      }
    );
  });
}

async function initDatabase() {
  console.log(`[init-db] Database path: ${DB_PATH}`);

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[init-db] Created directory: ${dir}`);
  }

  if (!fs.existsSync(INIT_SQL_PATH)) {
    console.error(`[init-db] init.sql not found at ${INIT_SQL_PATH}`);
    process.exit(1);
  }

  const db = await openDb();
  console.log('[init-db] Connected to SQLite');

  // Enable WAL mode and foreign keys
  await execSql(db, 'PRAGMA journal_mode = WAL;');
  await execSql(db, 'PRAGMA foreign_keys = ON;');
  console.log('[init-db] WAL mode and foreign keys enabled');

  // Read and execute init.sql
  let sql = fs.readFileSync(INIT_SQL_PATH, 'utf-8');

  // Remove comments to avoid parsing issues
  sql = sql.replace(/--.*$/gm, '');

  // Split by semicolons but keep CREATE TRIGGER blocks intact
  // SQLite init.sql doesn't have triggers now, so simple split is fine
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`[init-db] Executing ${statements.length} SQL statements...`);

  let executed = 0;
  let skipped = 0;
  for (const stmt of statements) {
    const fullStmt = stmt + ';';
    try {
      await execSql(db, fullStmt);
      executed++;
    } catch (err: any) {
      // Ignore "already exists" errors
      if (err.message && err.message.includes('already exists')) {
        skipped++;
      } else {
        console.error(`[init-db] SQL Error: ${err.message}`);
        console.error(`[init-db] Statement: ${fullStmt.slice(0, 200)}...`);
        // Continue with next statement
      }
    }
  }

  console.log(`[init-db] Executed: ${executed}, Skipped (already exists): ${skipped}`);

  const tables = await getTables(db);
  console.log(`[init-db] Total tables: ${tables.length} — ${tables.join(', ')}`);

  db.close();
  console.log('[init-db] Database initialization completed successfully');
}

async function clearData() {
  const db = await openDb();
  await execSql(db, 'PRAGMA foreign_keys = OFF;');

  const tables = await getTables(db);
  for (const table of tables) {
    if (table === 'sqlite_sequence') continue;
    try {
      await execSql(db, `DELETE FROM "${table}";`);
      console.log(`[init-db] Cleared table: ${table}`);
    } catch (err: any) {
      console.error(`[init-db] Failed to clear ${table}: ${err.message}`);
    }
  }

  await execSql(db, 'PRAGMA foreign_keys = ON;');
  db.close();
  console.log('[init-db] All data cleared');
}

async function resetDatabase() {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`[init-db] Removed database: ${DB_PATH}`);
  }
  await initDatabase();
}

async function checkDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('[init-db] Database file does not exist');
    process.exit(1);
  }
  const db = await openDb();
  const tables = await getTables(db);
  db.close();
  console.log(`[init-db] Database OK — ${tables.length} tables: ${tables.join(', ')}`);
}

async function main() {
  const command = process.argv[2] || 'init';

  switch (command) {
    case 'init':
    case 'seed':
      await initDatabase();
      break;
    case 'clear':
      await clearData();
      break;
    case 'reset':
      await resetDatabase();
      break;
    case 'check':
      await checkDatabase();
      break;
    default:
      console.log(`Usage: npx tsx scripts/init-db.ts [init|seed|clear|reset|check]`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('[init-db] Fatal error:', err);
  process.exit(1);
});
