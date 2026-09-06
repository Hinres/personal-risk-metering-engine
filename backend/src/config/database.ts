/**
 * [PRME-INFRA-003] 性能与缓存
 * [PRME-INFRA-006-P1-6] 双模式数据库配置（SQLite / PostgreSQL）
 * 文件: database.ts
 * 需求描述: 支持 SQLite（开发/测试）和 PostgreSQL（生产）双模式
 * 最后更新: 2026-06-19
 */
import { DataSource, DataSourceOptions } from 'typeorm';
import * as sqlite3 from 'sqlite3';
import { getDbType, setDbType } from '../utils/dbTypes';
import path from 'path';

// ── 迁移导入（tsx 下使用类引用，避免路径 glob 解析问题） ──
import { InitialSchema1718000000001 } from '../database/migrations/001-initial-schema';
import { NamingAlignmentMigration1718000000002 } from '../database/migrations/002-naming-alignment-migration';
import { PostgresqlFeatures1718000000003 } from '../database/migrations/003-postgresql-features';
import { ComplianceEvtMigration1718000000004 } from '../database/migrations/004-compliance-evt-migration';
import { AlertHistoryMonitorFkMigration1718000000005 } from '../database/migrations/005-alert-history-monitor-fk-migration';
import { V13FeatureModelsMigration1718000000006 } from '../database/migrations/006-v1.3-feature-models';
import { StockDailyBasicMigration1718000000007 } from '../database/migrations/007-stock-daily-basic-migration';

// ── 所有实体导入 ──
import { OptimizationResult } from '../models/OptimizationResult';
import { OptimizationScenario } from '../models/OptimizationScenario';
import { VaRComponent } from '../models/VaRComponent';
import { UserConsent } from '../models/UserConsent';
import { AdminApprovalRequest } from '../models/AdminApprovalRequest';
import { HoldingLimit } from '../models/HoldingLimit';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot';
import { StressScenario } from '../models/StressScenario';
import { HelpContent } from '../models/HelpContent';
import { MarketRiskAlert } from '../models/MarketRiskAlert';
import { MarketRiskAlertTemplate } from '../models/MarketRiskAlertTemplate';
import { MarketRiskAlertAcknowledgment } from '../models/MarketRiskAlertAcknowledgment';
import { AnonymizationLog } from '../models/AnonymizationLog';
import { AuditLogIntegrity } from '../models/AuditLogIntegrity';
import { UserLoginHistory } from '../models/UserLoginHistory';
import { DataExportRequest } from '../models/DataExportRequest';
import { User } from '../models/User';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { MarketData } from '../models/MarketData';
import { VaRCalculation } from '../models/VaRCalculation';
import { StressTest } from '../models/StressTest';
import { ToolVaRHistory } from '../models/ToolVaRHistory';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { Order } from '../models/Order';
import { SystemConfig } from '../models/SystemConfig';
import { UserSession } from '../models/UserSession';
import { Stock } from '../models/Stock';
import { FinancialData } from '../models/FinancialData';
import { StockDailyBasic } from '../models/StockDailyBasic';
import { ValuationRecord } from '../models/ValuationRecord';
import { AlertRule } from '../models/AlertRule';
import { AlertHistory } from '../models/AlertHistory';
import { AuditLog } from '../models/AuditLog';
import { Report } from '../models/Report';
import { MonitorConfig } from '../models/MonitorConfig';
import { MonitorSnapshot } from '../models/MonitorSnapshot';
import { PartitionMetadata } from '../models/PartitionMetadata';
import { ComputationCache } from '../models/ComputationCache';
import { MarketSnapshotCache } from '../models/MarketSnapshotCache';
import { PortfolioSummaryCache } from '../models/PortfolioSummaryCache';
import { MessageQueue } from '../models/MessageQueue';
import { RefreshTokenBlacklist } from '../models/RefreshTokenBlacklist';
import { StopLossSuggestion } from '../models/StopLossSuggestion';
import { RiskEventSource } from '../models/RiskEventSource';
import { RiskEvent } from '../models/RiskEvent';
import { RiskEventImpact } from '../models/RiskEventImpact';
import { MarketVolatilityIndex } from '../models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../models/MarketVolatilityHistory';
import { HoldingImportTask } from '../models/HoldingImportTask';
import { HoldingImportRow } from '../models/HoldingImportRow';
import { PortfolioTemplate } from '../models/PortfolioTemplate';
import { AttributionResult } from '../models/AttributionResult';
import { PortfolioAnalytics } from '../models/PortfolioAnalytics';
import { VideoTutorial } from '../models/VideoTutorial';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// 从环境变量确定数据库类型（确保在实体装饰器执行前已设置）
const dbType = (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres';
setDbType(dbType);

const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/database.sqlite');

const entities = [
  User, Portfolio, Holding, MarketData, VaRCalculation,
  StressTest, Report,
  SubscriptionPlan, Order, SystemConfig, UserSession,
  Stock, FinancialData, ValuationRecord, StockDailyBasic,
  VaRComponent, UserConsent, AdminApprovalRequest,
  HoldingLimit, PortfolioSnapshot, StressScenario,
  HelpContent, MarketRiskAlert, MarketRiskAlertTemplate, MarketRiskAlertAcknowledgment,
  AnonymizationLog, DataExportRequest, OptimizationResult, ToolVaRHistory,
  AuditLogIntegrity, UserLoginHistory,
  AlertRule, AlertHistory, AuditLog, Report, MonitorConfig,
  MonitorSnapshot, PartitionMetadata,
  ComputationCache, MarketSnapshotCache, PortfolioSummaryCache,
  MessageQueue, RefreshTokenBlacklist,
  StopLossSuggestion, RiskEventSource, RiskEvent, RiskEventImpact,
  MarketVolatilityIndex, MarketVolatilityHistory,
  HoldingImportTask, HoldingImportRow, PortfolioTemplate,
  AttributionResult, OptimizationScenario, PortfolioAnalytics, VideoTutorial, StockDailyBasic,
];

// ── SQLite 配置 ──
const sqliteConfig: DataSourceOptions = {
  type: 'sqlite',
  database: dbPath,
  entities,
  synchronize: isDevelopment || isTest,
  logging: isDevelopment ? ['query', 'error'] : ['error'],
  migrations: [InitialSchema1718000000001, NamingAlignmentMigration1718000000002, PostgresqlFeatures1718000000003, ComplianceEvtMigration1718000000004, AlertHistoryMonitorFkMigration1718000000005, V13FeatureModelsMigration1718000000006, StockDailyBasicMigration1718000000007],
  extra: {
    pragmas: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA foreign_keys = ON',
    ],
  },
};

// ── PostgreSQL 配置 ──
const postgresConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'prme_user',
  password: process.env.DB_PASSWORD || 'prme_password',
  database: process.env.DB_NAME || 'prme_db',
  schema: process.env.DB_SCHEMA || 'public',
  entities,
  synchronize: isDevelopment || isTest,
  logging: isDevelopment ? ['query', 'error'] : ['error'],
  migrations: [InitialSchema1718000000001, NamingAlignmentMigration1718000000002, PostgresqlFeatures1718000000003, ComplianceEvtMigration1718000000004, AlertHistoryMonitorFkMigration1718000000005, V13FeatureModelsMigration1718000000006, StockDailyBasicMigration1718000000007], // 生产环境建议手动运行：npx typeorm migration:run
  extra: {
    // 连接池配置
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  },
};

const activeConfig = dbType === 'postgres' ? postgresConfig : sqliteConfig;

export const AppDataSource = new DataSource(activeConfig);

// ── 视图创建（SQLite 专用） ──
async function createSQLiteViews(): Promise<void> {
  // 测试环境跳过视图创建（TypeORM synchronize 与视图有冲突）
  if (process.env.SKIP_SQLITE_VIEWS === 'true') {
    return;
  }

  const views = [
    {
      name: 'portfolio_overview',
      sql: `CREATE VIEW IF NOT EXISTS portfolio_overview AS
        SELECT p.portfolio_id, p.name, p.status, p.user_id,
               COUNT(h.holding_id) as holding_count,
               COALESCE(SUM(h.market_value), 0) as total_value
        FROM portfolios p
        LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
        WHERE p.status = 'active'
        GROUP BY p.portfolio_id`,
    },
    {
      name: 'risk_summary',
      sql: `CREATE VIEW IF NOT EXISTS risk_summary AS
        SELECT p.portfolio_id, p.name, p.user_id,
               v.var_value, v.var_percentage, v.confidence_level, v.calculation_type, v.calculated_at
        FROM portfolios p
        LEFT JOIN var_calculations v ON p.portfolio_id = v.portfolio_id
        WHERE p.status = 'active'`,
    },
    {
      name: 'monitor_status',
      sql: `CREATE VIEW IF NOT EXISTS monitor_status AS
        SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name, m.monitor_type, m.status, m.threshold, m.operator,
               COUNT(h.history_id) as active_alerts
        FROM monitor_configs m
        LEFT JOIN alert_history h ON m.portfolio_id = h.portfolio_id AND h.status = 'active'
        WHERE m.status = 'active'
        GROUP BY m.config_id`,
    },
  ];

  for (const view of views) {
    try {
      await AppDataSource.query(`DROP VIEW IF EXISTS ${view.name}`);
      await AppDataSource.query(view.sql);
    } catch (e: any) {
      console.warn(`[createSQLiteViews] Failed to create view ${view.name}: ${e.message}`);
    }
  }
}

// ── PostgreSQL 初始化（视图、分区、索引） ──
async function initializePostgres(): Promise<void> {
  // 1. 创建视图（PostgreSQL 语法）
  await AppDataSource.query(`DROP VIEW IF EXISTS portfolio_overview`);
  await AppDataSource.query(`
    CREATE OR REPLACE VIEW portfolio_overview AS
    SELECT p.portfolio_id, p.name, p.status, p.user_id,
           COUNT(h.holding_id) as holding_count,
           COALESCE(SUM(h.market_value), 0) as total_value
    FROM portfolios p
    LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
    WHERE p.status = 'active'
    GROUP BY p.portfolio_id
  `);

  await AppDataSource.query(`DROP VIEW IF EXISTS risk_summary`);
  await AppDataSource.query(`
    CREATE OR REPLACE VIEW risk_summary AS
    SELECT p.portfolio_id, p.name, p.user_id,
           v.var_value, v.var_percentage, v.confidence_level, v.calculation_type, v.calculated_at
    FROM portfolios p
    LEFT JOIN var_calculations v ON p.portfolio_id = v.portfolio_id
    WHERE p.status = 'active'
  `);

  await AppDataSource.query(`DROP VIEW IF EXISTS monitor_status`);
  await AppDataSource.query(`
    CREATE OR REPLACE VIEW monitor_status AS
    SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name, m.monitor_type, m.status, m.threshold, m.operator,
           COUNT(h.history_id) as active_alerts
    FROM monitor_configs m
    LEFT JOIN alert_history h ON m.portfolio_id = h.portfolio_id AND h.status = 'active'
    WHERE m.status = 'active'
    GROUP BY m.config_id
  `);

  // 2. 分区表（P1-2 结合 P1-6）
  // monitor_snapshots 按时间分区（RANGE 分区）
  // 注意：分区表创建建议通过 TypeORM 迁移脚本处理，这里仅做索引补充
  // synchronize 创建的普通表如需转为分区表，需要：
  //   1. 备份数据 2. DROP TABLE 3. 创建分区父表 4. 恢复数据到分区
  // 为安全起见，分区表转换不在启动时自动执行，需手动运行迁移脚本

  // 3. JSONB GIN 索引（自动在 synchronize 后补充）
  const ginIndexes = [
    { table: 'users', column: 'preferences', name: 'idx_users_preferences_gin' },
    { table: 'users', column: 'subscription', name: 'idx_users_subscription_gin' },
    { table: 'holdings', column: 'metadata', name: 'idx_holdings_metadata_gin' },
    { table: 'var_calculations', column: 'parameters', name: 'idx_var_parameters_gin' },
    { table: 'stress_tests', column: 'parameters', name: 'idx_stress_parameters_gin' },
    { table: 'stress_tests', column: 'result', name: 'idx_stress_result_gin' },
    { table: 'audit_logs', column: 'details', name: 'idx_audit_details_gin' },
    { table: 'computation_cache', column: 'cache_value', name: 'idx_cache_value_gin' },
  ];

  for (const idx of ginIndexes) {
    try {
      await AppDataSource.query(
        `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}" USING GIN ("${idx.column}")`
      );
    } catch (e: any) {
      // 列可能不存在（如果 synchronize 还没执行），忽略
    }
  }
}

export async function initializeDatabase(maxRetries = 5): Promise<DataSource> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // P1-4 修复：SQLite 下先删除依赖视图
      if (!AppDataSource.isInitialized && dbType === 'sqlite') {
        try {
          const tempDb = require('sqlite3').verbose();
          const db = new tempDb.Database(dbPath);
          await new Promise<void>((resolve, reject) => {
            db.exec(
              `DROP VIEW IF EXISTS portfolio_overview; DROP VIEW IF EXISTS risk_summary; DROP VIEW IF EXISTS monitor_status;`,
              (err: any) => { if (err) reject(err); else resolve(); }
            );
            db.close();
          });
        } catch (viewErr) {
          // 忽略
        }
        await AppDataSource.initialize();
      } else if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      if (dbType === 'sqlite') {
        await AppDataSource.query('PRAGMA journal_mode = WAL');
        await AppDataSource.query('PRAGMA foreign_keys = ON');
        await createSQLiteViews();
        console.log('Database connected successfully (SQLite)');
      } else {
        await initializePostgres();
        console.log('Database connected successfully (PostgreSQL)');
      }

      return AppDataSource;
    } catch (error) {
      retries++;
      console.error(`Database connection attempt ${retries} failed:`, error);
      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }
      const delay = Math.pow(2, retries) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unexpected error in database initialization');
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}
