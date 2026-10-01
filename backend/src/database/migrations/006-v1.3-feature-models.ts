/**
 * [PRME-v1.3] 数据模型变更迁移
 * 文件: 006-v1.3-feature-models.ts
 * 范围: 新增 v1.3 功能所需表 + 扩展现有表 + 初始化基础数据
 * 日期: 2026-08-20
 * 修订(2026-09-29): 移除 PostgreSQL 分支，SQLite 单库（REQ-DEC-20260926-001）
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import logger from '../../utils/logger';

export class V13FeatureModelsMigration1718000000006 implements MigrationInterface {
  name = 'V13FeatureModelsMigration1718000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();
    logger.info('[006] Starting v1.3 feature models migration...');

    try {
      // 1. 新增风险管理表
      await this.createStopLossSuggestions(queryRunner);
      await this.createRiskEventTables(queryRunner);
      await this.createMarketVolatilityTables(queryRunner);

      // 2. 新增投资组合分析表
      await this.createHoldingImportTables(queryRunner);
      await this.createPortfolioTemplates(queryRunner);
      await this.createAttributionResults(queryRunner);
      await this.createOptimizationScenarios(queryRunner);
      await this.createPortfolioAnalytics(queryRunner);

      // 3. 新增工具与设置表
      await this.createVideoTutorials(queryRunner);

      // 4. 确保被扩展的表存在（新数据库可能尚未创建这些实体表）
      await this.ensureExistingTables(queryRunner);

      // 5. 扩展现有表
      await this.alterExistingTables(queryRunner);

      // 6. 初始化基础数据
      await this.seedInitialData(queryRunner);

      logger.info('[006] v1.3 feature models migration completed.');
    } catch (error: any) {
      logger.error('[006] Migration failed', { error: error.message });
      throw error;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    logger.warn('[006] down() is a no-op: dropping v1.3 tables manually is risky');
  }

  // ────────────────────────── 新表创建 ──────────────────────────

  private async createStopLossSuggestions(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stop_loss_suggestions (
        suggestion_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        portfolio_id ${uuid} NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
        user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        confidence_level DECIMAL(5,4) NOT NULL,
        time_horizon INT NOT NULL DEFAULT 1,
        dimension VARCHAR(20) NOT NULL,
        basis VARCHAR(30) NOT NULL,
        suggestions TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        triggered_count INT DEFAULT 0,
        last_triggered_at DATETIME,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stop_loss_portfolio ON stop_loss_suggestions(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stop_loss_user ON stop_loss_suggestions(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stop_loss_created ON stop_loss_suggestions(created_at)`);
  }

  private async createRiskEventTables(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_event_sources (
        source_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        source_type VARCHAR(30) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        config TEXT,
        is_active BOOLEAN DEFAULT true,
        last_fetch_at DATETIME,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_source_type ON risk_event_sources(source_type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_source_active ON risk_event_sources(is_active)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_events (
        event_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        source_id ${uuid} NOT NULL REFERENCES risk_event_sources(source_id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL,
        external_id VARCHAR(255),
        title VARCHAR(500) NOT NULL,
        summary TEXT,
        content TEXT,
        url VARCHAR(1000),
        level VARCHAR(20) NOT NULL,
        symbols TEXT,
        sectors TEXT,
        macro_tags TEXT,
        occurred_at DATETIME NOT NULL,
        fetched_at DATETIME DEFAULT ${now},
        is_processed BOOLEAN DEFAULT false
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_risk_events_source ON risk_events(source_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_risk_events_occurred ON risk_events(occurred_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_risk_events_level ON risk_events(level)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_risk_events_external ON risk_events(source_id, external_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_event_impacts (
        impact_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        event_id ${uuid} NOT NULL REFERENCES risk_events(event_id) ON DELETE CASCADE,
        user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        portfolio_id ${uuid} NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
        holding_id ${uuid} REFERENCES holdings(holding_id) ON DELETE CASCADE,
        symbol VARCHAR(20),
        impact_level VARCHAR(20) NOT NULL,
        impact_summary TEXT,
        portfolio_weight DECIMAL(10,6),
        is_notified BOOLEAN DEFAULT false,
        notified_at DATETIME,
        is_read BOOLEAN DEFAULT false,
        read_at DATETIME,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_impact_event ON risk_event_impacts(event_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_impact_user ON risk_event_impacts(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_impact_portfolio ON risk_event_impacts(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_impact_notified ON risk_event_impacts(user_id, is_notified)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_impact_read ON risk_event_impacts(user_id, is_read)`);
  }

  private async createMarketVolatilityTables(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS market_volatility_indices (
        index_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        index_symbol VARCHAR(20) NOT NULL UNIQUE,
        index_name VARCHAR(100) NOT NULL,
        weight DECIMAL(5,4) NOT NULL DEFAULT 0,
        source VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_volatility_index_symbol ON market_volatility_indices(index_symbol)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS market_volatility_history (
        history_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        index_symbol VARCHAR(20) NOT NULL,
        volatility DECIMAL(10,6) NOT NULL,
        percentile DECIMAL(5,4),
        calculation_date DATE NOT NULL,
        calculation_time DATETIME DEFAULT ${now},
        data_points INT DEFAULT 252,
        UNIQUE(index_symbol, calculation_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_volatility_history_symbol_date ON market_volatility_history(index_symbol, calculation_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_volatility_history_date ON market_volatility_history(calculation_date)`);
  }

  private async createHoldingImportTables(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS holding_import_tasks (
        task_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        portfolio_id ${uuid} NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
        user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_size INT,
        format VARCHAR(10) NOT NULL,
        total_rows INT NOT NULL DEFAULT 0,
        valid_rows INT NOT NULL DEFAULT 0,
        error_rows INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        triggered_var BOOLEAN DEFAULT false,
        triggered_stress BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT ${now},
        completed_at DATETIME
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_task_portfolio ON holding_import_tasks(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_task_user ON holding_import_tasks(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_task_status ON holding_import_tasks(status)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS holding_import_rows (
        row_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        task_id ${uuid} NOT NULL REFERENCES holding_import_tasks(task_id) ON DELETE CASCADE,
        row_number INT NOT NULL,
        raw_data TEXT,
        parsed_data TEXT,
        is_valid BOOLEAN DEFAULT false,
        error_fields TEXT,
        created_holding_id ${uuid} REFERENCES holdings(holding_id),
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_row_task ON holding_import_rows(task_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_row_valid ON holding_import_rows(task_id, is_valid)`);
  }

  private async createPortfolioTemplates(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS portfolio_templates (
        template_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        risk_level VARCHAR(20) NOT NULL,
        asset_allocation TEXT NOT NULL,
        sector_allocation TEXT,
        sample_holdings TEXT,
        base_total_value DECIMAL(18,4) DEFAULT 100000,
        disclaimer TEXT NOT NULL,
        is_builtin BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT ${now},
        updated_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_template_risk_level ON portfolio_templates(risk_level)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_template_active ON portfolio_templates(is_active)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_template_sort ON portfolio_templates(sort_order)`);
  }

  private async createAttributionResults(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attribution_results (
        attribution_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        portfolio_id ${uuid} NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
        user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        benchmark_type VARCHAR(30) NOT NULL,
        benchmark_config TEXT,
        portfolio_return DECIMAL(10,6) NOT NULL,
        benchmark_return DECIMAL(10,6) NOT NULL,
        excess_return DECIMAL(10,6) NOT NULL,
        allocation_effect DECIMAL(10,6) NOT NULL,
        selection_effect DECIMAL(10,6) NOT NULL,
        interaction_effect DECIMAL(10,6) NOT NULL,
        sector_details TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_attribution_portfolio ON attribution_results(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_attribution_user ON attribution_results(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_attribution_created ON attribution_results(created_at)`);
  }

  private async createOptimizationScenarios(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS optimization_scenarios (
        scenario_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name VARCHAR(100) NOT NULL,
        objective VARCHAR(30) NOT NULL,
        description TEXT,
        constraints TEXT,
        scoring_model TEXT,
        filter_rules TEXT,
        backtest_period_days INT DEFAULT 252,
        disclaimer TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_optimization_scenario_objective ON optimization_scenarios(objective)`);
  }

  private async createPortfolioAnalytics(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS portfolio_analytics (
        analytics_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        portfolio_id ${uuid} NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
        user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        analysis_date DATE NOT NULL,
        total_value DECIMAL(18,4),
        total_return DECIMAL(10,6),
        annual_return DECIMAL(10,6),
        volatility DECIMAL(10,6),
        sharpe_ratio DECIMAL(10,6),
        sortino_ratio DECIMAL(10,6),
        max_drawdown DECIMAL(10,6),
        calmar_ratio DECIMAL(10,6),
        treynor_ratio DECIMAL(10,6),
        beta DECIMAL(10,6),
        risk_free_rate DECIMAL(10,6),
        metrics TEXT,
        created_at DATETIME DEFAULT ${now},
        UNIQUE(portfolio_id, analysis_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_portfolio ON portfolio_analytics(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_date ON portfolio_analytics(analysis_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_portfolio_date ON portfolio_analytics(portfolio_id, analysis_date)`);
  }

  private async createVideoTutorials(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS video_tutorials (
        video_id ${uuid} PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        topic VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        video_url VARCHAR(500) NOT NULL,
        duration INT,
        thumbnail_url VARCHAR(500),
        category VARCHAR(50) DEFAULT 'tutorial',
        tags TEXT,
        sort_order INT DEFAULT 0,
        watch_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT ${now},
        updated_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_video_topic ON video_tutorials(topic)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_video_category ON video_tutorials(category)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_video_active ON video_tutorials(is_active)`);
  }

  // ────────────────────────── 确保被扩展的表存在 ──────────────────────────

  private async ensureExistingTables(queryRunner: QueryRunner): Promise<void> {
    await this.ensurePortfolioSnapshots(queryRunner);
    await this.ensureOptimizationResults(queryRunner);
    await this.ensureHelpContent(queryRunner);
  }

  private async ensurePortfolioSnapshots(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const pkDefault = 'DEFAULT (lower(hex(randomblob(16))))';
    const now = 'CURRENT_TIMESTAMP';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        snapshot_id ${uuid} PRIMARY KEY ${pkDefault},
        portfolio_id ${uuid} NOT NULL,
        snapshot_date DATE NOT NULL,
        total_market_value DECIMAL(18,4),
        total_cost DECIMAL(18,4),
        daily_return DECIMAL(10,6),
        cumulative_return DECIMAL(10,6),
        total_return DECIMAL(10,6),
        annual_return DECIMAL(10,6),
        volatility DECIMAL(10,6),
        sharpe_ratio DECIMAL(10,6),
        sortino_ratio DECIMAL(10,6),
        max_drawdown DECIMAL(10,6),
        calmar_ratio DECIMAL(10,6),
        treynor_ratio DECIMAL(10,6),
        beta DECIMAL(10,6),
        risk_free_rate DECIMAL(10,6),
        asset_allocation TEXT,
        sector_allocation TEXT,
        holdings_snapshot TEXT,
        created_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_portfolio ON portfolio_snapshots(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_date ON portfolio_snapshots(snapshot_date)`);
  }

  private async ensureOptimizationResults(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const pkDefault = 'DEFAULT (lower(hex(randomblob(16))))';
    const now = 'CURRENT_TIMESTAMP';
    const bool = 'INTEGER';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS optimization_results (
        optimization_id ${uuid} PRIMARY KEY ${pkDefault},
        portfolio_id ${uuid} NOT NULL,
        user_id ${uuid} NOT NULL,
        method VARCHAR(50) NOT NULL,
        objective_detail VARCHAR(30),
        scoring_model VARCHAR(50),
        filter_rules TEXT,
        backtest_scenario_id ${uuid},
        backtest_metrics TEXT,
        current_portfolio TEXT,
        optimized_portfolio TEXT,
        suggestions TEXT,
        backtest_data TEXT,
        disclaimer TEXT,
        compliance_note TEXT,
        has_investment_keywords ${bool} DEFAULT false,
        status VARCHAR(20) DEFAULT 'completed',
        error_message TEXT,
        created_at DATETIME DEFAULT ${now},
        updated_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_optimization_portfolio ON optimization_results(portfolio_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_optimization_user ON optimization_results(user_id)`);
  }

  private async ensureHelpContent(queryRunner: QueryRunner): Promise<void> {
    const uuid = 'varchar(36)';
    const pkDefault = 'DEFAULT (lower(hex(randomblob(16))))';
    const now = 'CURRENT_TIMESTAMP';
    const bool = 'INTEGER';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS help_content (
        content_id ${uuid} PRIMARY KEY ${pkDefault},
        topic VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(20) DEFAULT 'general',
        status VARCHAR(20) DEFAULT 'published',
        tags TEXT,
        format VARCHAR(20) DEFAULT 'markdown',
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        content_type VARCHAR(20) DEFAULT 'markdown',
        video_id ${uuid},
        thumbnail_url VARCHAR(500),
        duration INT,
        images TEXT,
        sort_order INTEGER DEFAULT 0,
        related_topics TEXT,
        is_active ${bool} DEFAULT true,
        created_at DATETIME DEFAULT ${now},
        updated_at DATETIME DEFAULT ${now}
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_help_topic ON help_content(topic)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_help_category ON help_content(category)`);
  }

  // ────────────────────────── 扩展现有表 ──────────────────────────

  private async alterExistingTables(queryRunner: QueryRunner): Promise<void> {
    // portfolios
    await this.addColumnIfNotExists(queryRunner, 'portfolios', 'investment_goal', 'VARCHAR(50)');
    await this.addColumnIfNotExists(queryRunner, 'portfolios', 'risk_level', 'VARCHAR(20)');
    await this.addColumnIfNotExists(queryRunner, 'portfolios', 'template_id', 'VARCHAR(36)');

    // portfolio_snapshots
    const snapshotCols = [
      'total_return', 'annual_return', 'volatility', 'sharpe_ratio',
      'sortino_ratio', 'max_drawdown', 'calmar_ratio', 'treynor_ratio', 'beta', 'risk_free_rate'
    ];
    for (const col of snapshotCols) {
      await this.addColumnIfNotExists(queryRunner, 'portfolio_snapshots', col, 'DECIMAL(10,6)');
    }
    await this.addColumnIfNotExists(queryRunner, 'portfolio_snapshots', 'asset_allocation', 'TEXT');
    await this.addColumnIfNotExists(queryRunner, 'portfolio_snapshots', 'sector_allocation', 'TEXT');
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_date ON portfolio_snapshots(snapshot_date)`);

    // optimization_results
    await this.addColumnIfNotExists(queryRunner, 'optimization_results', 'objective_detail', 'VARCHAR(30)');
    await this.addColumnIfNotExists(queryRunner, 'optimization_results', 'scoring_model', 'VARCHAR(50)');
    await this.addColumnIfNotExists(queryRunner, 'optimization_results', 'filter_rules', 'TEXT');
    await this.addColumnIfNotExists(queryRunner, 'optimization_results', 'backtest_scenario_id', 'VARCHAR(36)');
    await this.addColumnIfNotExists(queryRunner, 'optimization_results', 'backtest_metrics', 'TEXT');

    // help_content
    await this.addColumnIfNotExists(queryRunner, 'help_content', 'video_id', 'VARCHAR(36)');
    await this.addColumnIfNotExists(queryRunner, 'help_content', 'thumbnail_url', 'VARCHAR(500)');
    await this.addColumnIfNotExists(queryRunner, 'help_content', 'duration', 'INT');

    // holdings
    await this.addColumnIfNotExists(queryRunner, 'holdings', 'import_row_id', 'VARCHAR(36)');
  }

  private async addColumnIfNotExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    type: string,
  ): Promise<void> {
    const res = await queryRunner.query(`PRAGMA table_info("${table}")`);
    if (!res.find((r: any) => r.name === column)) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    }
  }

  // ────────────────────────── 初始化数据 ──────────────────────────

  private async seedInitialData(queryRunner: QueryRunner): Promise<void> {
    // 默认波动率指数
    const indices = [
      { symbol: '000300.SH', name: '沪深300', weight: 0.4 },
      { symbol: '000905.SH', name: '中证500', weight: 0.3 },
      { symbol: '399006.SZ', name: '创业板指', weight: 0.2 },
      { symbol: '000016.SH', name: '上证50', weight: 0.1 },
    ];
    for (const idx of indices) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM market_volatility_indices WHERE index_symbol = '${idx.symbol}'
      `);
      if (!exists || exists.length === 0) {
        const id = 'lower(hex(randomblob(16)))';
        await queryRunner.query(`
          INSERT INTO market_volatility_indices (index_id, index_symbol, index_name, weight, source, is_active)
          VALUES (${id}, '${idx.symbol}', '${idx.name}', ${idx.weight}, 'default', true)
        `);
      }
    }

    // 默认优化场景
    const scenarios = [
      { name: '高收益目标', objective: 'return_high_yield', desc: '优先近1年收益率排名靠前的股票' },
      { name: '成长目标', objective: 'return_growth', desc: '优先营收/利润增长较快的股票' },
      { name: '价值目标', objective: 'return_value', desc: '优先低PE/PB的股票' },
      { name: '股息目标', objective: 'return_dividend', desc: '优先高股息率、分红持续性好的股票' },
      { name: '综合优化', objective: 'balanced', desc: '风险收益平衡的综合方案' },
      { name: '风险优化', objective: 'risk', desc: '现有风险分散化/风险平价/最小方差方案' },
    ];
    for (const s of scenarios) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM optimization_scenarios WHERE objective = '${s.objective}'
      `);
      if (!exists || exists.length === 0) {
        const id = 'lower(hex(randomblob(16)))';
        await queryRunner.query(`
          INSERT INTO optimization_scenarios (scenario_id, name, objective, description, disclaimer, is_active)
          VALUES (${id}, '${s.name}', '${s.objective}', '${s.desc}', '本优化场景仅供参考，不构成投资建议。', true)
        `);
      }
    }

    // 默认组合模板
    const templates = [
      {
        name: '保守型',
        risk_level: 'conservative',
        asset: JSON.stringify({ stock: 0.30, bond: 0.50, cash: 0.20 }),
        sector: JSON.stringify({ 金融: 0.20, 消费: 0.10, 债券现金: 0.70 }),
        sample: JSON.stringify([
          { symbol: '000001.SZ', name: '平安银行', sector: '金融', weight: 0.10 },
          { symbol: '600519.SS', name: '贵州茅台', sector: '消费', weight: 0.10 },
        ]),
      },
      {
        name: '平衡型',
        risk_level: 'moderate',
        asset: JSON.stringify({ stock: 0.60, bond: 0.30, cash: 0.10 }),
        sector: JSON.stringify({ 金融: 0.20, 消费: 0.20, 科技: 0.15, 医药: 0.05, 其他: 0.30 }),
        sample: JSON.stringify([
          { symbol: '000001.SZ', name: '平安银行', sector: '金融', weight: 0.10 },
          { symbol: '600519.SS', name: '贵州茅台', sector: '消费', weight: 0.10 },
          { symbol: '000858.SZ', name: '五粮液', sector: '消费', weight: 0.05 },
          { symbol: '002415.SZ', name: '海康威视', sector: '科技', weight: 0.05 },
          { symbol: '600276.SS', name: '恒瑞医药', sector: '医药', weight: 0.05 },
        ]),
      },
      {
        name: '进取型',
        risk_level: 'aggressive',
        asset: JSON.stringify({ stock: 0.90, cash: 0.10 }),
        sector: JSON.stringify({ 科技: 0.30, 消费: 0.20, 医药: 0.15, 金融: 0.15, 其他: 0.20 }),
        sample: JSON.stringify([
          { symbol: '002415.SZ', name: '海康威视', sector: '科技', weight: 0.10 },
          { symbol: '000725.SZ', name: '京东方A', sector: '科技', weight: 0.10 },
          { symbol: '600519.SS', name: '贵州茅台', sector: '消费', weight: 0.10 },
          { symbol: '000858.SZ', name: '五粮液', sector: '消费', weight: 0.10 },
          { symbol: '600276.SS', name: '恒瑞医药', sector: '医药', weight: 0.10 },
          { symbol: '000001.SZ', name: '平安银行', sector: '金融', weight: 0.10 },
        ]),
      },
    ];

    let sortOrder = 1;
    for (const t of templates) {
      const exists = await queryRunner.query(`SELECT 1 FROM portfolio_templates WHERE name = '${t.name}'`);
      if (!exists || exists.length === 0) {
        const id = 'lower(hex(randomblob(16)))';
        await queryRunner.query(`
          INSERT INTO portfolio_templates (
            template_id, name, description, risk_level, asset_allocation, sector_allocation,
            sample_holdings, base_total_value, disclaimer, is_builtin, is_active, sort_order
          ) VALUES (
            ${id}, '${t.name}', '${t.name}组合模板', '${t.risk_level}', '${t.asset}', '${t.sector}',
            '${t.sample}', 100000, '本模板仅为风险分散化参考，不构成投资建议。', true, true, ${sortOrder++}
          )
        `);
      }
    }

    // 默认视频教程
    const videos = [
      {
        topic: 'intro',
        title: 'PRME 快速入门',
        description: '了解如何创建组合、导入持仓并查看风险指标。',
        video_url: 'https://example.com/prme-intro.mp4',
        duration: 180,
        thumbnail_url: 'https://example.com/thumbnails/intro.png',
        category: 'tutorial',
        tags: JSON.stringify(['入门', '组合', '风险']),
      },
      {
        topic: 'risk',
        title: '如何理解 VaR 与最大回撤',
        description: '用通俗语言解释 VaR、最大回撤等核心风险指标。',
        video_url: 'https://example.com/prme-risk-metrics.mp4',
        duration: 240,
        thumbnail_url: 'https://example.com/thumbnails/risk.png',
        category: 'tutorial',
        tags: JSON.stringify(['VaR', '最大回撤', '风险指标']),
      },
      {
        topic: 'monitor',
        title: '设置风险监控与预警',
        description: '教用户配置监控规则、接收多渠道通知。',
        video_url: 'https://example.com/prme-monitor.mp4',
        duration: 210,
        thumbnail_url: 'https://example.com/thumbnails/monitor.png',
        category: 'tutorial',
        tags: JSON.stringify(['监控', '预警', '通知']),
      },
      {
        topic: 'stop_loss',
        title: '止损建议使用指南',
        description: '如何生成和解读单股、行业、组合层面的止损参考。',
        video_url: 'https://example.com/prme-stop-loss.mp4',
        duration: 195,
        thumbnail_url: 'https://example.com/thumbnails/stop-loss.png',
        category: 'feature',
        tags: JSON.stringify(['止损', '建议', 'v1.3']),
      },
      {
        topic: 'optimization',
        title: '组合优化与归因分析',
        description: '介绍优化场景选择、归因结果和历史对比功能。',
        video_url: 'https://example.com/prme-optimization.mp4',
        duration: 260,
        thumbnail_url: 'https://example.com/thumbnails/optimization.png',
        category: 'feature',
        tags: JSON.stringify(['优化', '归因', '历史对比']),
      },
    ];

    let videoSortOrder = 1;
    for (const v of videos) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM video_tutorials WHERE topic = '${v.topic}' AND title = '${v.title}'
      `);
      if (!exists || exists.length === 0) {
        const id = 'lower(hex(randomblob(16)))';
        await queryRunner.query(`
          INSERT INTO video_tutorials (
            video_id, topic, title, description, video_url, duration, thumbnail_url,
            category, tags, sort_order, is_active
          ) VALUES (
            ${id}, '${v.topic}', '${v.title}', '${v.description}', '${v.video_url}',
            ${v.duration}, '${v.thumbnail_url}', '${v.category}', '${v.tags}',
            ${videoSortOrder++}, true
          )
        `);
      }
    }

    // 默认风险事件来源
    const sources = [
      { type: 'announcement', provider: 'manual', name: '个股公告（手动维护）' },
      { type: 'industry_policy', provider: 'manual', name: '行业政策（手动维护）' },
      { type: 'macro_data', provider: 'manual', name: '宏观数据（手动维护）' },
      { type: 'announcement', provider: 'tushare', name: '个股公告（Tushare）' },
      { type: 'industry_policy', provider: 'akshare', name: '行业政策（AKShare）' },
      { type: 'macro_data', provider: 'akshare', name: '宏观数据（AKShare）' },
    ];
    for (const s of sources) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM risk_event_sources WHERE source_type = '${s.type}' AND provider = '${s.provider}'
      `);
      if (!exists || exists.length === 0) {
        const id = 'lower(hex(randomblob(16)))';
        await queryRunner.query(`
          INSERT INTO risk_event_sources (source_id, source_type, provider, name, is_active)
          VALUES (${id}, '${s.type}', '${s.provider}', '${s.name}', true)
        `);
      }
    }
  }
}
