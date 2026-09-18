/**
 * [PRME-v1.3.1-F01] holdings.purchase_date 列迁移与存量回填
 * 文件: 008-v1.3.1-purchase-date-migration.ts
 * 范围: holdings 表新增 purchase_date(date, nullable) 列；从 metadata JSON 回填存量数据
 * 设计来源: PRME-v1.3.1-Detailed-Design-20260918.md §1.2
 * 日期: 2026-09-18
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import { getDbType } from '../../utils/dbTypes';
import logger from '../../utils/logger';

/** 兼容 date 列与 metadata 中多种取值的统一日期串提取（YYYY-MM-DD 或 null） */
export function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export class PurchaseDateMigration1718000000008 implements MigrationInterface {
  name = 'PurchaseDateMigration1718000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();
    const dbType = getDbType();
    logger.info('[008] Starting holdings.purchase_date migration...');

    const table = 'holdings';
    const columnName = 'purchase_date';

    const hasColumn = async (): Promise<boolean> => {
      if (dbType === 'postgres') {
        const rows: any[] = await queryRunner.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${columnName}'`
        );
        return rows.length > 0;
      }
      const rows: any[] = await queryRunner.query(`PRAGMA table_info(${table})`);
      return rows.some((r: any) => r.name === columnName);
    };

    if (!(await hasColumn())) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${columnName} date NULL`);
      logger.info('[008] purchase_date column added.');
    } else {
      logger.info('[008] purchase_date column already exists, skipping DDL.');
    }

    await this.backfill(queryRunner);

    logger.info('[008] purchase_date migration completed.');
  }

  /**
   * 存量回填：metadata.purchase_date（YYYY-MM-DD）→ purchase_date 列。
   * 逐行用 TypeScript 回填，保证 sqlite/Postgres 双方言一致；幂等（仅回填 NULL 行）。
   */
  async backfill(queryRunner: QueryRunner): Promise<number> {
    const rows: any[] = await queryRunner.query(
      `SELECT holding_id, metadata FROM holdings WHERE purchase_date IS NULL`
    );

    let updated = 0;
    for (const row of rows) {
      let metadata: any = null;
      try {
        metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      } catch {
        continue;
      }
      const dateStr = metadata ? toDateString(metadata.purchase_date) : null;
      if (!dateStr) continue;

      await queryRunner.query(
        `UPDATE holdings SET purchase_date = '${dateStr}' WHERE holding_id = '${row.holding_id}'`
      );
      updated++;
    }

    logger.info(`[008] Backfilled purchase_date for ${updated} holdings.`);
    return updated;
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite 不支持 DROP COLUMN（3.35 以下），此处仅清空数据，列保留
    await queryRunner.query(`UPDATE holdings SET purchase_date = NULL`);
    logger.info('[008] down: purchase_date values cleared (column retained).');
  }
}
