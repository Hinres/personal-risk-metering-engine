/**
 * [PRME-v1.3-PA-003] stock_daily_basic 表迁移
 * 文件: 007-stock-daily-basic-migration.ts
 * 范围: 新增 stock_daily_basic 表（每日估值/股息率快照，供优化筛选使用）
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §4.1
 * 日期: 2026-09-06
 * 修订(2026-09-29): 移除 PostgreSQL 分支，SQLite 单库（REQ-DEC-20260926-001）
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import logger from '../../utils/logger';

export class StockDailyBasicMigration1718000000007 implements MigrationInterface {
  name = 'StockDailyBasicMigration1718000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();
    logger.info('[007] Starting stock_daily_basic migration...');

    const uuid = 'varchar(36)';
    const dateType = 'date';

    const exists = await queryRunner.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='stock_daily_basic'`
    ).catch(() => []);

    const tableExists = Array.isArray(exists) && exists.length > 0;

    if (tableExists) {
      logger.info('[007] stock_daily_basic already exists, skipping');
      return;
    }

    await queryRunner.query(`
      CREATE TABLE stock_daily_basic (
        id            ${uuid} PRIMARY KEY,
        symbol        varchar(20) NOT NULL,
        trade_date    ${dateType} NOT NULL,
        pe_ttm        decimal(12,4),
        pb            decimal(12,4),
        dv_ratio      decimal(10,4),
        total_mv      decimal(18,2),
        turnover_rate decimal(10,4),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_sdb_symbol_date ON stock_daily_basic(symbol, trade_date)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_sdb_symbol ON stock_daily_basic(symbol, trade_date)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_sdb_date ON stock_daily_basic(trade_date)`
    );

    logger.info('[007] stock_daily_basic migration completed.');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stock_daily_basic`);
  }
}
