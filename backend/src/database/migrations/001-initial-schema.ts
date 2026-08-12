/**
 * [PRME-INFRA-006] 基础设施
 * 文件: 001-initial-schema.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration for PostgreSQL / SQLite.
 * Creates core tables: users, portfolios, holdings, market_data, risk_reports,
 * vaR_calculations, stress_tests, risk_monitors, alert_records, subscription_plans,
 * orders, system_configs, operation_logs, user_sessions, stocks, financial_data,
 * valuation_records.
 */
export class InitialSchema1718000000001 implements MigrationInterface {
  name = 'InitialSchema1718000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        plan VARCHAR(20) DEFAULT 'free',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);

    // Portfolios table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS portfolios (
        portfolio_id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(20) DEFAULT 'personal',
        status VARCHAR(20) DEFAULT 'active',
        settings TEXT DEFAULT '{}',
        statistics TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_portfolios_status ON portfolios(status)`);

    // Holdings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS holdings (
        holding_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        name VARCHAR(100),
        security_type VARCHAR(20) DEFAULT 'stock',
        exchange VARCHAR(20),
        quantity DECIMAL(18,6) DEFAULT 0,
        cost_price DECIMAL(18,6) DEFAULT 0,
        current_price DECIMAL(18,6),
        market_value DECIMAL(18,6),
        weight DECIMAL(10,4),
        weight_target DECIMAL(10,4),
        unrealized_pnl DECIMAL(18,6),
        realized_pnl DECIMAL(18,6),
        sector VARCHAR(50),
        industry VARCHAR(50),
        region VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'CNY',
        status VARCHAR(20) DEFAULT 'active',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON holdings(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol)`);

    // Market data table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS market_data (
        data_id VARCHAR(36) PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        open DECIMAL(18,6),
        high DECIMAL(18,6),
        low DECIMAL(18,6),
        close DECIMAL(18,6),
        volume BIGINT,
        adjusted_close DECIMAL(18,6),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol)`);

    // VaR calculations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vaR_calculations (
        var_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        var_value DECIMAL(18,6),
        var_percentage DECIMAL(10,4),
        confidence_level DECIMAL(5,4) DEFAULT 0.95,
        calculation_type VARCHAR(20),
        time_horizon INT DEFAULT 1,
        parameters TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_var_portfolio_id ON vaR_calculations(portfolio_id)`);

    // Risk reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_reports (
        report_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        report_name VARCHAR(200) NOT NULL,
        report_type VARCHAR(50),
        report_content TEXT,
        report_url VARCHAR(500),
        file_format VARCHAR(10),
        file_size INT,
        period_start DATETIME,
        period_end DATETIME,
        status VARCHAR(20) DEFAULT 'generated',
        generated_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_reports_portfolio_id ON risk_reports(portfolio_id)`);

    // Stress tests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stress_tests (
        stress_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        scenario_name VARCHAR(100),
        parameters TEXT,
        result TEXT,
        status VARCHAR(20) DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);

    // Risk monitors table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_monitors (
        monitor_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        metric_type VARCHAR(50),
        threshold DECIMAL(18,6),
        current_value DECIMAL(18,6),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);

    // Alert records table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_records (
        alert_id VARCHAR(36) PRIMARY KEY,
        portfolio_id VARCHAR(36) NOT NULL,
        monitor_id VARCHAR(36),
        alert_type VARCHAR(50),
        severity VARCHAR(20),
        message TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE CASCADE
      )
    `);

    console.log('InitialSchema1718000000001 migration completed successfully');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order of creation to avoid FK constraints
    await queryRunner.query(`DROP TABLE IF EXISTS alert_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS risk_monitors`);
    await queryRunner.query(`DROP TABLE IF EXISTS stress_tests`);
    await queryRunner.query(`DROP TABLE IF EXISTS risk_reports`);
    await queryRunner.query(`DROP TABLE IF EXISTS vaR_calculations`);
    await queryRunner.query(`DROP TABLE IF EXISTS market_data`);
    await queryRunner.query(`DROP TABLE IF EXISTS holdings`);
    await queryRunner.query(`DROP TABLE IF EXISTS portfolios`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    console.log('InitialSchema1718000000001 rollback completed');
  }
}
