/**
 * [PRME-INFRA-006] 基础设施
 * 文件: 002-naming-alignment-migration.ts
 * 需求描述: P1-1 数据模型命名统一迁移脚本（SQLite 单库，REQ-DEC-20260926-001）
 * 最后更新: 2026-09-29
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import logger from '../../utils/logger';

/**
 * P1-1 命名统一迁移
 * 将旧表数据迁移到新表，保持向后兼容。
 *
 * 本迁移为“数据回填”型迁移：仅在旧表存在且非空时执行数据复制；
 * 若旧表不存在（例如全新数据库或 001 初始迁移未创建该表），则直接跳过，
 * 避免启动时因表缺失报错。
 */
export class NamingAlignmentMigration1718000000002 implements MigrationInterface {
  name = 'NamingAlignmentMigration1718000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await runNamingAlignmentMigration(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 命名统一迁移不可逆：旧表数据已复制到新表，不建议自动删除新表数据
    logger.warn('NamingAlignmentMigration1718000000002 down() is a no-op');
  }
}

export async function runNamingAlignmentMigration(queryRunner: QueryRunner) {
  await queryRunner.connect();

  try {
    logger.info('Starting P1-1 naming alignment migration...');

    // 1. alert_records → alert_history
    await migrateAlertRecords(queryRunner);

    // 2. operation_logs → audit_logs
    await migrateOperationLogs(queryRunner);

    // 3. risk_reports → reports
    await migrateRiskReports(queryRunner);

    // 4. risk_monitors → monitor_configs
    await migrateRiskMonitors(queryRunner);

    // 5. 更新 views
    await updateViews(queryRunner);

    logger.info('P1-1 naming alignment migration completed successfully');
  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

/**
 * 检查表是否存在（SQLite）
 */
async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
  const result = await queryRunner.query(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );

  return Array.isArray(result) && result.length > 0;
}

async function migrateAlertRecords(queryRunner: QueryRunner) {
  if (!(await tableExists(queryRunner, 'alert_records'))) {
    logger.info('alert_records does not exist, skipping migration');
    return;
  }

  // 检查旧表是否有数据
  const countResult = await queryRunner.query(`SELECT COUNT(*) as cnt FROM alert_records`);
  const count = countResult[0]?.cnt || 0;
  if (count === 0) {
    logger.info('alert_records is empty, skipping migration');
    return;
  }

  logger.info(`Migrating ${count} alert_records → alert_history`);

  // 复制数据（字段映射）
  await queryRunner.query(`
    INSERT INTO alert_history (
      history_id, portfolio_id, rule_id, user_id, alert_type, severity, title, message,
      trigger_details, notification_status, triggered_at, resolved_at, status, created_at
    )
    SELECT
      alert_id, portfolio_id, monitor_id, user_id, alert_type, severity, title, message,
      trigger_details, notification_status, triggered_at, resolved_at, status, created_at
    FROM alert_records
  `);

  logger.info(`Migrated ${count} alert records`);
}

async function migrateOperationLogs(queryRunner: QueryRunner) {
  if (!(await tableExists(queryRunner, 'operation_logs'))) {
    logger.info('operation_logs does not exist, skipping migration');
    return;
  }

  const countResult = await queryRunner.query(`SELECT COUNT(*) as cnt FROM operation_logs`);
  const count = countResult[0]?.cnt || 0;
  if (count === 0) {
    logger.info('operation_logs is empty, skipping migration');
    return;
  }

  logger.info(`Migrating ${count} operation_logs → audit_logs`);

  await queryRunner.query(`
    INSERT INTO audit_logs (
      log_id, user_id, operation_type, resource_type, resource_id, details,
      ip_address, user_agent, created_at
    )
    SELECT
      log_id, user_id, operation_type, resource_type, resource_id, details,
      ip_address, user_agent, created_at
    FROM operation_logs
  `);

  logger.info(`Migrated ${count} operation logs`);
}

async function migrateRiskReports(queryRunner: QueryRunner) {
  if (!(await tableExists(queryRunner, 'risk_reports'))) {
    logger.info('risk_reports does not exist, skipping migration');
    return;
  }

  const countResult = await queryRunner.query(`SELECT COUNT(*) as cnt FROM risk_reports`);
  const count = countResult[0]?.cnt || 0;
  if (count === 0) {
    logger.info('risk_reports is empty, skipping migration');
    return;
  }

  logger.info(`Migrating ${count} risk_reports → reports`);

  await queryRunner.query(`
    INSERT INTO reports (
      report_id, portfolio_id, user_id, report_name, report_type, period_start,
      period_end, report_content, report_url, file_format, file_size, status,
      created_at, generated_at, expires_at
    )
    SELECT
      report_id, portfolio_id, user_id, report_name, report_type, period_start,
      period_end, report_content, report_url, file_format, file_size, status,
      created_at, generated_at, expires_at
    FROM risk_reports
  `);

  logger.info(`Migrated ${count} risk reports`);
}

async function migrateRiskMonitors(queryRunner: QueryRunner) {
  if (!(await tableExists(queryRunner, 'risk_monitors'))) {
    logger.info('risk_monitors does not exist, skipping migration');
    return;
  }

  const countResult = await queryRunner.query(`SELECT COUNT(*) as cnt FROM risk_monitors`);
  const count = countResult[0]?.cnt || 0;
  if (count === 0) {
    logger.info('risk_monitors is empty, skipping migration');
    return;
  }

  logger.info(`Migrating ${count} risk_monitors → monitor_configs`);

  await queryRunner.query(`
    INSERT INTO monitor_configs (
      config_id, portfolio_id, user_id, config_name, monitor_type, threshold, operator,
      status, notification, rules, created_at, updated_at, last_triggered, trigger_count
    )
    SELECT
      monitor_id, portfolio_id, user_id, monitor_name, monitor_type, threshold, operator,
      status, notification, rules, created_at, updated_at, last_triggered, trigger_count
    FROM risk_monitors
  `);

  logger.info(`Migrated ${count} risk monitors`);
}

async function updateViews(queryRunner: QueryRunner) {
  logger.info('Updating views...');

  // SQLite: 不支持 CREATE OR REPLACE VIEW
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

  logger.info('Views updated');
}

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    try {
      const { AppDataSource } = await import('../../config/database');
      await AppDataSource.initialize();
      const runner = AppDataSource.createQueryRunner();
      try {
        await runNamingAlignmentMigration(runner);
      } finally {
        await runner.release();
      }
      await AppDataSource.destroy();
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
