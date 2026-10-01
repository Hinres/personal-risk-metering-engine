/**
 * [PRME-INFRA-003] 性能与缓存
 * [PRME-DB-SQLITE-ONLY] SQLite 单库配置（REQ-DEC-20260926-001 / ARC-REV-20260929-001）
 * 文件: database.ts
 * 需求描述: 数据库唯一正式选型为 SQLite 3.39+ (WAL 模式)，禁止双数据库/双模式设计
 * 最后更新: 2026-09-29
 */
import { DataSource, DataSourceOptions } from 'typeorm';
import path from 'path';

// ── 迁移导入（tsx 下使用类引用，避免路径 glob 解析问题） ──
import { InitialSchema1718000000001 } from '../database/migrations/001-initial-schema';
import { NamingAlignmentMigration1718000000002 } from '../database/migrations/002-naming-alignment-migration';
import { ComplianceEvtMigration1718000000004 } from '../database/migrations/004-compliance-evt-migration';
import { AlertHistoryMonitorFkMigration1718000000005 } from '../database/migrations/005-alert-history-monitor-fk-migration';
import { V13FeatureModelsMigration1718000000006 } from '../database/migrations/006-v1.3-feature-models';
import { StockDailyBasicMigration1718000000007 } from '../database/migrations/007-stock-daily-basic-migration';
import { PurchaseDateMigration1718000000008 } from '../database/migrations/008-v1.3.1-purchase-date-migration';
import { UserFeedbackMigration1718000000009 } from '../database/migrations/009-v1.3.2-user-feedback-migration';

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
import { UserFeedback } from '../models/UserFeedback';
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
const isTest = process.env.NODE_ENV === 'test';

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
  UserFeedback,
];

// ── SQLite 配置（唯一正式数据库选型：SQLite 3.39+ WAL） ──
const sqliteConfig: DataSourceOptions = {
  type: 'sqlite',
  database: dbPath,
  entities,
  synchronize: isDevelopment || isTest,
  logging: isDevelopment ? ['query', 'error'] : ['error'],
  migrations: [InitialSchema1718000000001, NamingAlignmentMigration1718000000002, ComplianceEvtMigration1718000000004, AlertHistoryMonitorFkMigration1718000000005, V13FeatureModelsMigration1718000000006, StockDailyBasicMigration1718000000007, PurchaseDateMigration1718000000008, UserFeedbackMigration1718000000009],
  extra: {
    pragmas: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA foreign_keys = ON',
    ],
  },
};

export const AppDataSource = new DataSource(sqliteConfig);

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

export async function initializeDatabase(maxRetries = 5): Promise<DataSource> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // SQLite 下先删除依赖视图，避免 synchronize 与视图冲突
      if (!AppDataSource.isInitialized) {
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
      }

      await AppDataSource.query('PRAGMA journal_mode = WAL');
      await AppDataSource.query('PRAGMA foreign_keys = ON');
      await createSQLiteViews();
      console.log('Database connected successfully (SQLite)');

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
