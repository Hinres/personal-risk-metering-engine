/**
 * [PRME-INFRA-006-P1-6] PostgreSQL 特有功能迁移
 * 文件: 003-postgresql-features.ts
 * 需求描述: P1-6 PostgreSQL 迁移 — 分区表、JSONB GIN 索引、视图
 * 最后更新: 2026-06-19
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P1-6 PostgreSQL 特性迁移
 * 仅在 PostgreSQL 数据库下执行
 */
export class PostgresqlFeatures1718000000003 implements MigrationInterface {
  name = 'PostgresqlFeatures1718000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 检测是否为 PostgreSQL（SQLite 无 version() 函数，需先捕获异常）
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      console.log('[P1-6] Skipping PostgreSQL-specific migration (not PostgreSQL)');
      return;
    }

    console.log('[P1-6] Applying PostgreSQL-specific features...');

    // ── 1. JSONB GIN 索引 ──
    await this.createGinIndexes(queryRunner);

    // ── 2. 分区表：monitor_snapshots ──
    await this.createPartitionedMonitorSnapshots(queryRunner);

    // ── 3. 分区表：audit_logs ──
    await this.createPartitionedAuditLogs(queryRunner);

    // ── 4. PostgreSQL 视图 ──
    await this.createViews(queryRunner);

    console.log('[P1-6] PostgreSQL features applied successfully');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 分区表回滚较复杂，通常需要手动处理
    // 这里仅删除索引和视图
    await queryRunner.query(`DROP VIEW IF EXISTS portfolio_overview`);
    await queryRunner.query(`DROP VIEW IF EXISTS risk_summary`);
    await queryRunner.query(`DROP VIEW IF EXISTS monitor_status`);

    const indexes = [
      'idx_users_preferences_gin',
      'idx_users_subscription_gin',
      'idx_holdings_metadata_gin',
      'idx_var_parameters_gin',
      'idx_stress_parameters_gin',
      'idx_stress_result_gin',
      'idx_audit_details_gin',
      'idx_cache_value_gin',
    ];
    for (const idx of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${idx}"`);
    }
  }

  // ── JSONB GIN 索引 ──
  private async createGinIndexes(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      { table: 'users', column: 'preferences', name: 'idx_users_preferences_gin' },
      { table: 'users', column: 'subscription', name: 'idx_users_subscription_gin' },
      { table: 'holdings', column: 'metadata', name: 'idx_holdings_metadata_gin' },
      { table: 'var_calculations', column: 'parameters', name: 'idx_var_parameters_gin' },
      { table: 'stress_tests', column: 'parameters', name: 'idx_stress_parameters_gin' },
      { table: 'stress_tests', column: 'result', name: 'idx_stress_result_gin' },
      { table: 'audit_logs', column: 'details', name: 'idx_audit_details_gin' },
      { table: 'computation_cache', column: 'cache_value', name: 'idx_cache_value_gin' },
    ];

    for (const idx of indexes) {
      try {
        await queryRunner.query(
          `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}" USING GIN ("${idx.column}")`
        );
        console.log(`[P1-6] Created GIN index: ${idx.name}`);
      } catch (e: any) {
        console.warn(`[P1-6] GIN index ${idx.name} skipped: ${e.message}`);
      }
    }
  }

  // ── 分区表：monitor_snapshots ──
  private async createPartitionedMonitorSnapshots(queryRunner: QueryRunner): Promise<void> {
    // 检查是否已有分区子表
    const hasPartitions = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename LIKE 'monitor_snapshots_%'
      ) AS exists
    `);

    if (hasPartitions[0]?.exists) {
      console.log('[P1-6] monitor_snapshots partitions already exist, skipping');
      return;
    }

    // 检查是否有普通表（由 synchronize 创建）
    const hasTable = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'monitor_snapshots'
      ) AS exists
    `);

    if (hasTable[0]?.exists) {
      // 备份数据、删除普通表、创建分区父表
      console.log('[P1-6] Converting monitor_snapshots to partitioned table...');

      // 1. 备份数据
      await queryRunner.query(`
        CREATE TABLE monitor_snapshots_backup AS SELECT * FROM monitor_snapshots
      `);

      // 2. 删除外键约束（避免删除表时失败）
      await queryRunner.query(`
        ALTER TABLE monitor_snapshots DROP CONSTRAINT IF EXISTS "FK_monitor_snapshots_portfolio"
      `);

      // 3. 删除普通表
      await queryRunner.query(`DROP TABLE monitor_snapshots`);

      // 4. 创建分区父表
      await queryRunner.query(`
        CREATE TABLE monitor_snapshots (
          snapshot_id UUID DEFAULT gen_random_uuid(),
          portfolio_id UUID NOT NULL,
          monitor_type VARCHAR(50),
          metric_value DECIMAL(18,6),
          threshold_value DECIMAL(18,6),
          operator VARCHAR(10),
          holdings_risk JSONB,
          extra_metrics JSONB,
          snapshot_at TIMESTAMP NOT NULL,
          PRIMARY KEY (snapshot_id, snapshot_at)
        ) PARTITION BY RANGE (snapshot_at)
      `);

      // 5. 创建未来 12 个月的分区
      await this.createMonthlyPartitions(queryRunner, 'monitor_snapshots', 12);

      // 6. 恢复数据
      await queryRunner.query(`
        INSERT INTO monitor_snapshots 
        SELECT * FROM monitor_snapshots_backup
      `);
      await queryRunner.query(`DROP TABLE monitor_snapshots_backup`);

      console.log('[P1-6] monitor_snapshots converted to partitioned table');
    } else {
      // 全新环境：直接创建分区父表
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS monitor_snapshots (
          snapshot_id UUID DEFAULT gen_random_uuid(),
          portfolio_id UUID NOT NULL,
          monitor_type VARCHAR(50),
          metric_value DECIMAL(18,6),
          threshold_value DECIMAL(18,6),
          operator VARCHAR(10),
          holdings_risk JSONB,
          extra_metrics JSONB,
          snapshot_at TIMESTAMP NOT NULL,
          PRIMARY KEY (snapshot_id, snapshot_at)
        ) PARTITION BY RANGE (snapshot_at)
      `);
      await this.createMonthlyPartitions(queryRunner, 'monitor_snapshots', 12);
      console.log('[P1-6] Created partitioned monitor_snapshots');
    }
  }

  // ── 分区表：audit_logs ──
  private async createPartitionedAuditLogs(queryRunner: QueryRunner): Promise<void> {
    const hasPartitions = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename LIKE 'audit_logs_%'
      ) AS exists
    `);

    if (hasPartitions[0]?.exists) {
      console.log('[P1-6] audit_logs partitions already exist, skipping');
      return;
    }

    const hasTable = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'audit_logs'
      ) AS exists
    `);

    if (hasTable[0]?.exists) {
      console.log('[P1-6] Converting audit_logs to partitioned table...');
      await queryRunner.query(`CREATE TABLE audit_logs_backup AS SELECT * FROM audit_logs`);
      await queryRunner.query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS "FK_audit_logs_user"`);
      await queryRunner.query(`DROP TABLE audit_logs`);

      await queryRunner.query(`
        CREATE TABLE audit_logs (
          log_id UUID DEFAULT gen_random_uuid(),
          user_id UUID,
          operation_type VARCHAR(50) NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id UUID,
          details JSONB DEFAULT '{}',
          ip_address VARCHAR(50),
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL,
          PRIMARY KEY (log_id, created_at)
        ) PARTITION BY RANGE (created_at)
      `);

      await this.createMonthlyPartitions(queryRunner, 'audit_logs', 12);

      await queryRunner.query(`INSERT INTO audit_logs SELECT * FROM audit_logs_backup`);
      await queryRunner.query(`DROP TABLE audit_logs_backup`);

      console.log('[P1-6] audit_logs converted to partitioned table');
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          log_id UUID DEFAULT gen_random_uuid(),
          user_id UUID,
          operation_type VARCHAR(50) NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id UUID,
          details JSONB DEFAULT '{}',
          ip_address VARCHAR(50),
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL,
          PRIMARY KEY (log_id, created_at)
        ) PARTITION BY RANGE (created_at)
      `);
      await this.createMonthlyPartitions(queryRunner, 'audit_logs', 12);
      console.log('[P1-6] Created partitioned audit_logs');
    }
  }

  // ── 创建月度分区 ──
  private async createMonthlyPartitions(
    queryRunner: QueryRunner,
    tableName: string,
    months: number
  ): Promise<void> {
    const now = new Date();
    for (let i = -1; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const nextYear = nextD.getFullYear();
      const nextMonth = String(nextD.getMonth() + 1).padStart(2, '0');

      const partitionName = `${tableName}_${year}_${month}`;
      const startDate = `${year}-${month}-01`;
      const endDate = `${nextYear}-${nextMonth}-01`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${partitionName}" 
        PARTITION OF "${tableName}" 
        FOR VALUES FROM ('${startDate}') TO ('${endDate}')
      `);
    }
    console.log(`[P1-6] Created ${months + 1} monthly partitions for ${tableName}`);
  }

  // ── PostgreSQL 视图 ──
  private async createViews(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS portfolio_overview`);
    await queryRunner.query(`
      CREATE OR REPLACE VIEW portfolio_overview AS
      SELECT p.portfolio_id, p.name, p.status, p.user_id,
             COUNT(h.holding_id) as holding_count,
             COALESCE(SUM(h.market_value), 0) as total_value
      FROM portfolios p
      LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
      WHERE p.status = 'active'
      GROUP BY p.portfolio_id
    `);

    await queryRunner.query(`DROP VIEW IF EXISTS risk_summary`);
    await queryRunner.query(`
      CREATE OR REPLACE VIEW risk_summary AS
      SELECT p.portfolio_id, p.name, p.user_id,
             v.var_value, v.var_percentage, v.confidence_level, v.calculation_type, v.calculated_at
      FROM portfolios p
      LEFT JOIN var_calculations v ON p.portfolio_id = v.portfolio_id
      WHERE p.status = 'active'
    `);

    await queryRunner.query(`DROP VIEW IF EXISTS monitor_status`);
    await queryRunner.query(`
      CREATE OR REPLACE VIEW monitor_status AS
      SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name,
             m.monitor_type, m.status, m.threshold, m.operator,
             COUNT(h.history_id) as active_alerts
      FROM monitor_configs m
      LEFT JOIN alert_history h ON m.portfolio_id = h.portfolio_id AND h.status = 'active'
      WHERE m.status = 'active'
      GROUP BY m.config_id
    `);

    console.log('[P1-6] Views created');
  }
}
