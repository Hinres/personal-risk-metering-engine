/**
 * 迁移验证脚本：在全新 SQLite 数据库上执行所有待运行迁移
 * 用法：NODE_ENV=uat SQLITE_DB_PATH=/tmp/prme-migration-test.sqlite TUSHARE_TOKEN= npx tsx scripts/verify-migrations.ts
 */
import { AppDataSource } from '../src/config/database';

async function main() {
  try {
    await AppDataSource.initialize();
    console.log('[verify] Database initialized');

    const pending = await AppDataSource.showMigrations();
    console.log('[verify] Pending migrations:', pending);

    await AppDataSource.runMigrations();
    console.log('[verify] All migrations executed successfully');

    // 验证关键表是否创建
    const tables = await AppDataSource.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('portfolio_snapshots', 'optimization_results', 'help_content') ORDER BY name`
    );
    console.log('[verify] Required tables:', tables.map((t: any) => t.name));

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('[verify] Migration verification failed:', error.message || error);
    try {
      await AppDataSource.destroy();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

main();
