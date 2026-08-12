/**
 * [PRME-RM-002] UAT-BUG-20260729-001 修复迁移
 * 文件: 005-alert-history-monitor-fk-migration.ts
 * 问题: alert_history.rule_id 外键错误地指向 alert_rules，但业务代码写入的是
 *       monitor_configs.config_id，导致每次触发监控告警时都报 SQLITE_CONSTRAINT。
 * 修复: 删除指向 alert_rules 的旧外键约束，新建指向 monitor_configs(config_id) 的约束。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { getDbType } from '../../utils/dbTypes';
import logger from '../../utils/logger';

export class AlertHistoryMonitorFkMigration1718000000005 implements MigrationInterface {
  name = 'AlertHistoryMonitorFkMigration1718000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();
    const dbType = getDbType();

    try {
      logger.info('[005] Starting alert_history FK fix migration...');

      if (dbType === 'postgres') {
        await this.migratePostgres(queryRunner);
      } else {
        await this.migrateSQLite(queryRunner);
      }

      logger.info('[005] alert_history FK fix migration completed.');
    } catch (error: any) {
      logger.error('[005] Migration failed', { error: error.message });
      throw error;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    logger.warn('[005] down() is a no-op: reverting FK change manually is risky');
  }

  private async migratePostgres(queryRunner: QueryRunner): Promise<void> {
    // 如果已经修复，直接跳过
    const alreadyFixed = await queryRunner.query(`
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'alert_history'::regclass
        AND contype = 'f'
        AND confrelid = 'monitor_configs'::regclass
    `);
    if (Array.isArray(alreadyFixed) && alreadyFixed.length > 0) {
      logger.info('[005] Postgres FK already points to monitor_configs, skipping');
      return;
    }

    // 删除指向 alert_rules 的旧外键（如果存在）
    const oldFks = await queryRunner.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'alert_history'::regclass
        AND contype = 'f'
        AND confrelid = 'alert_rules'::regclass
    `);
    for (const row of oldFks || []) {
      await queryRunner.query(`ALTER TABLE alert_history DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      logger.info(`[005] Dropped old FK "${row.conname}"`);
    }

    // 新建指向 monitor_configs 的外键
    await queryRunner.query(`
      ALTER TABLE alert_history
      ADD CONSTRAINT "FK_alert_history_rule_monitor"
      FOREIGN KEY (rule_id) REFERENCES monitor_configs(config_id)
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    logger.info('[005] Created FK alert_history(rule_id) -> monitor_configs(config_id)');

    await this.refreshMonitorStatusView(queryRunner, 'postgres');
  }

  private async migrateSQLite(queryRunner: QueryRunner): Promise<void> {
    const tableRows = await queryRunner.query(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='alert_history'`
    );
    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      logger.warn('[005] alert_history table not found, skipping');
      return;
    }

    const createSql: string = tableRows[0].sql;

    // 已修复则跳过
    if (createSql.includes('REFERENCES "monitor_configs" ("config_id")')) {
      logger.info('[005] SQLite FK already points to monitor_configs, skipping');
      return;
    }

    if (!createSql.includes('REFERENCES "alert_rules" ("rule_id")')) {
      logger.warn('[005] Could not find old alert_rules FK, skipping to avoid corrupting schema');
      return;
    }

    // 删除依赖视图，重建表后再恢复
    await queryRunner.query(`DROP VIEW IF EXISTS monitor_status`);

    // 删除旧 FK 约束定义，并在末尾加上新 FK
    const oldFkRegex = /,?\s*CONSTRAINT\s+"[^"]+"\s+FOREIGN\s+KEY\s*\("rule_id"\)\s+REFERENCES\s+"alert_rules"\s*\("rule_id"\)[^,)]*/i;
    let cleanedSql = createSql.replace(oldFkRegex, '');
    cleanedSql = cleanedSql.replace(/,\s*\)/g, ')');

    const newFk = ', CONSTRAINT "FK_alert_history_rule_monitor" FOREIGN KEY ("rule_id") REFERENCES "monitor_configs" ("config_id") ON DELETE NO ACTION ON UPDATE NO ACTION';
    const fixedSql = cleanedSql.replace(/\)\s*$/, newFk + ')');

    // 通过重建表方式修改外键（SQLite 不支持 ALTER TABLE DROP CONSTRAINT）
    const newTableSql = fixedSql.replace('CREATE TABLE "alert_history"', 'CREATE TABLE "alert_history_new"');

    await queryRunner.query('PRAGMA foreign_keys = OFF');
    try {
      await queryRunner.query(newTableSql);
      await queryRunner.query(`INSERT INTO "alert_history_new" SELECT * FROM "alert_history"`);
      await queryRunner.query(`DROP TABLE "alert_history"`);
      await queryRunner.query(`ALTER TABLE "alert_history_new" RENAME TO "alert_history"`);
      logger.info('[005] Recreated alert_history with FK -> monitor_configs(config_id)');
    } finally {
      await queryRunner.query('PRAGMA foreign_keys = ON');
    }

    await this.refreshMonitorStatusView(queryRunner, 'sqlite');
  }

  private async refreshMonitorStatusView(queryRunner: QueryRunner, dbType: string): Promise<void> {
    if (dbType === 'postgres') {
      await queryRunner.query(`DROP VIEW IF EXISTS monitor_status`);
      await queryRunner.query(`
        CREATE OR REPLACE VIEW monitor_status AS
        SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name,
               m.monitor_type, m.status, m.threshold, m.operator,
               COUNT(a.history_id) as active_alerts
        FROM monitor_configs m
        LEFT JOIN alert_history a ON m.portfolio_id = a.portfolio_id AND a.status = 'active'
        WHERE m.status = 'active'
        GROUP BY m.config_id
      `);
    } else {
      await queryRunner.query(`DROP VIEW IF EXISTS monitor_status`);
      await queryRunner.query(`
        CREATE VIEW IF NOT EXISTS monitor_status AS
        SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name,
               m.monitor_type, m.status, m.threshold, m.operator,
               COUNT(a.history_id) as active_alerts
        FROM monitor_configs m
        LEFT JOIN alert_history a ON m.portfolio_id = a.portfolio_id AND a.status = 'active'
        WHERE m.status = 'active'
        GROUP BY m.config_id
      `);
    }
    logger.info('[005] Refreshed monitor_status view');
  }
}
