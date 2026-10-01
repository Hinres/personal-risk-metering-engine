/**
 * [PRME-INFRA-007] 等保优化 + EVT MLE 数据模型迁移
 * 文件: 004-compliance-evt-migration.ts
 * 需求描述:
 *   - 新建 audit_log_integrity 表（审计日志哈希链防篡改）
 *   - 新建 user_login_history 表（登录历史与异常检测）
 *   - var_calculations 表新增字段：estimation_method, evt_parameters, warnings
 *   - var_calculations 表添加 calculation_type CHECK 约束（或触发器备选）
 * 最后更新: 2026-09-29（移除 PostgreSQL 分支，SQLite 单库 REQ-DEC-20260926-001）
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ComplianceEvtMigration1718000000004 implements MigrationInterface {
  name = 'ComplianceEvtMigration1718000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[004] Running migration on sqlite...');

    // ── 1. 新建 audit_log_integrity 表 ──
    await this.createAuditLogIntegrityTable(queryRunner);

    // ── 2. 新建 user_login_history 表 ──
    await this.createUserLoginHistoryTable(queryRunner);

    // ── 3. var_calculations 新增字段 ──
    await this.addVarCalculationColumns(queryRunner);

    // ── 4. var_calculations 添加 CHECK 约束 ──
    await this.addCalculationTypeCheck(queryRunner);

    console.log('[004] Migration completed successfully');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[004] Rolling back migration...');

    // 4. 移除 CHECK 触发器
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_var_calculations_check_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_var_calculations_check_update`);

    // 3. SQLite 不支持 DROP COLUMN，简化处理：不回滚新增字段

    // 2. 删除 user_login_history 表
    await queryRunner.query(`DROP TABLE IF EXISTS user_login_history`);

    // 1. 删除 audit_log_integrity 表
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log_integrity`);

    console.log('[004] Rollback completed');
  }

  // ── 1. audit_log_integrity 表 ──
  private async createAuditLogIntegrityTable(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await this.tableExists(queryRunner, 'audit_log_integrity');
    if (tableExists) {
      console.log('[004] audit_log_integrity already exists, skipping');
      return;
    }

      await queryRunner.query(`
        CREATE TABLE audit_log_integrity (
          integrity_id VARCHAR(36) PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          log_id VARCHAR(36) NOT NULL UNIQUE,
          log_hash VARCHAR(64) NOT NULL,
          previous_hash VARCHAR(64) NOT NULL,
          chain_root VARCHAR(64) NOT NULL,
          chain_index INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryRunner.query(`CREATE INDEX idx_audit_log_integrity_log_id ON audit_log_integrity (log_id)`);
      await queryRunner.query(`CREATE INDEX idx_audit_log_integrity_chain_index ON audit_log_integrity (chain_index)`);

    console.log('[004] Created audit_log_integrity table');
  }

  // ── 2. user_login_history 表 ──
  private async createUserLoginHistoryTable(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await this.tableExists(queryRunner, 'user_login_history');
    if (tableExists) {
      console.log('[004] user_login_history already exists, skipping');
      return;
    }

      await queryRunner.query(`
        CREATE TABLE user_login_history (
          login_id VARCHAR(36) PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          user_id VARCHAR(36) NOT NULL,
          login_type VARCHAR(20) NOT NULL,
          ip_address VARCHAR(50),
          user_agent TEXT,
          device_fingerprint VARCHAR(100),
          location VARCHAR(50),
          is_successful INTEGER DEFAULT 0,
          failure_reason VARCHAR(200),
          session_token_jti VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryRunner.query(`CREATE INDEX idx_user_login_history_user_id ON user_login_history (user_id)`);
      await queryRunner.query(`CREATE INDEX idx_user_login_history_created_at ON user_login_history (created_at)`);

    console.log('[004] Created user_login_history table');
  }

  // ── 3. var_calculations 新增字段 ──
  private async addVarCalculationColumns(queryRunner: QueryRunner): Promise<void> {
    // 检查字段是否已存在
    const columns = await this.getTableColumns(queryRunner, 'var_calculations');

    if (!columns.includes('estimation_method')) {
      await queryRunner.query(`ALTER TABLE var_calculations ADD COLUMN estimation_method VARCHAR(10)`);
      console.log('[004] Added estimation_method column');
    }

    if (!columns.includes('evt_parameters')) {
      await queryRunner.query(`ALTER TABLE var_calculations ADD COLUMN evt_parameters TEXT`);
      console.log('[004] Added evt_parameters column');
    }

    if (!columns.includes('warnings')) {
      await queryRunner.query(`ALTER TABLE var_calculations ADD COLUMN warnings TEXT`);
      console.log('[004] Added warnings column');
    }
  }

  // ── 4. var_calculations CHECK 约束 ──
  private async addCalculationTypeCheck(queryRunner: QueryRunner): Promise<void> {
    // 检查约束/触发器是否已存在
    const constraintExists = await this.checkConstraintExists(queryRunner, 'var_calculations', 'CHK_calculation_type');
    if (constraintExists) {
      console.log('[004] CHK_calculation_type already exists, skipping');
      return;
    }

    // SQLite: ALTER TABLE 不支持 ADD CONSTRAINT CHECK
    // 使用两个独立触发器分别处理 INSERT 和 UPDATE
      await this.createSQLiteCheckTriggers(queryRunner);
  }

  // ── SQLite CHECK 触发器（INSERT + UPDATE 分开） ──
  private async createSQLiteCheckTriggers(queryRunner: QueryRunner): Promise<void> {
    // INSERT 触发器
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS trg_var_calculations_check_insert
      BEFORE INSERT ON var_calculations
      FOR EACH ROW
      WHEN NEW.calculation_type NOT IN ('historical', 'parametric', 'monte_carlo', 'extreme_value')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid calculation_type. Must be one of: historical, parametric, monte_carlo, extreme_value');
      END
    `);

    // UPDATE 触发器
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS trg_var_calculations_check_update
      BEFORE UPDATE ON var_calculations
      FOR EACH ROW
      WHEN NEW.calculation_type NOT IN ('historical', 'parametric', 'monte_carlo', 'extreme_value')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid calculation_type. Must be one of: historical, parametric, monte_carlo, extreme_value');
      END
    `);

    console.log('[004] Created SQLite CHECK triggers as fallback');
  }

  // ── 辅助方法：检查表是否存在 ──
  private async tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
      const result = await queryRunner.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'
      `);
      return result.length > 0;
  }

  // ── 辅助方法：获取表字段列表 ──
  private async getTableColumns(queryRunner: QueryRunner, tableName: string): Promise<string[]> {
      const result = await queryRunner.query(`PRAGMA table_info(${tableName})`);
      return result.map((r: any) => r.name);
  }

  // ── 辅助方法：检查约束是否存在 ──
  private async checkConstraintExists(queryRunner: QueryRunner, tableName: string, constraintName: string): Promise<boolean> {
    // SQLite: 检查表 SQL 定义中是否包含约束名
      const tableResult = await queryRunner.query(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='${tableName}'
      `);
      if (tableResult.length > 0 && tableResult[0].sql?.includes(constraintName)) {
        return true;
      }

      // 检查触发器
      const triggerResult = await queryRunner.query(`
        SELECT name FROM sqlite_master
        WHERE type='trigger' AND (name='trg_var_calculations_check_insert' OR name='trg_var_calculations_check_update')
      `);
      return triggerResult.length >= 2;
  }
}
