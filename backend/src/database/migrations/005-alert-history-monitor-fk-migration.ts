/**
 * [PRME-RM-002] UAT-BUG-20260729-001 修复迁移
 * 文件: 005-alert-history-monitor-fk-migration.ts
 * 问题: alert_history.rule_id 外键错误地指向 alert_rules，但业务代码写入的是
 *       monitor_configs.config_id，导致每次触发监控告警时都报 SQLITE_CONSTRAINT。
 * 修复: 删除指向 alert_rules 的旧外键约束，新建指向 monitor_configs(config_id) 的约束。
 * 修订(2026-09-29): 移除 PostgreSQL 分支，SQLite 单库（REQ-DEC-20260926-001）
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import logger from '../../utils/logger';

export class AlertHistoryMonitorFkMigration1718000000005 implements MigrationInterface {
  name = 'AlertHistoryMonitorFkMigration1718000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();

    try {
      logger.info('[005] Starting alert_history FK fix migration...');

      await this.migrateSQLite(queryRunner);

      logger.info('[005] alert_history FK fix migration completed.');
    } catch (error: any) {
      logger.error('[005] Migration failed', { error: error.message });
      throw error;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    logger.warn('[005] down() is a no-op: reverting FK change manually is risky');
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

    await this.refreshMonitorStatusView(queryRunner);
  }

  private async refreshMonitorStatusView(queryRunner: QueryRunner): Promise<void> {
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
    logger.info('[005] Refreshed monitor_status view');
  }
}
