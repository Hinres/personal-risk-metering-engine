-- ============================================
-- 个人风险计量引擎 - SQLite 数据库初始化脚本
-- 版本: v4.0 (SQLite) - 同步代码实际 schema
-- 更新: 2026-07-13
-- 上游: 13 项 UAT 修复后完整 schema
-- ============================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS "users" (
  "user_id" varchar PRIMARY KEY NOT NULL,
  "username" varchar(50) NOT NULL,
  "email" varchar(100),
  "phone" varchar(20),
  "phone_encrypted" varchar(255),
  "openid" varchar(64),
  "unionid" varchar(64),
  "password_hash" varchar(255),
  "avatar_url" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "role" varchar(20) NOT NULL DEFAULT 'user',
  "first_risk_acknowledged" boolean NOT NULL DEFAULT 0,
  "first_risk_acknowledged_at" datetime,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  "last_login" datetime,
  "login_count" integer NOT NULL DEFAULT 0,
  "deleted_at" datetime,
  "deleted_by" varchar,
  "preferences" text NOT NULL DEFAULT ('{}'),
  "subscription" text NOT NULL DEFAULT ('{}'),
  "wechat_info" text,
  "metadata" text NOT NULL DEFAULT ('{}'),
  CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"),
  CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
  CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"),
  CONSTRAINT "UQ_9c98f005249412c8333a3b2c593" UNIQUE ("openid")
);

CREATE INDEX IF NOT EXISTS "IDX_9c98f005249412c8333a3b2c59" ON "users" ("openid");
CREATE INDEX IF NOT EXISTS "IDX_a000cca60bcf04454e72769949" ON "users" ("phone");
CREATE INDEX IF NOT EXISTS "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username");

-- ============================================
-- 2. 用户同意表 (user_consents) - 明示同意 (CMP-002)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_consents" (
  "consent_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "consent_type" varchar(50) NOT NULL,
  "consent_version" varchar(20) NOT NULL,
  "consent_text_hash" varchar(64) NOT NULL,
  "granted_at" datetime NOT NULL DEFAULT (datetime('now')),
  "granted_via" varchar(20) NOT NULL,
  "ip_address" varchar(45),
  "revoked_at" datetime,
  "revoked_reason" text,
  "is_active" boolean NOT NULL DEFAULT 1,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_6283f1222bdc2390cf16836ce7d" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_fc51c44e296132242ed415f181" ON "user_consents" ("consent_type");

-- ============================================
-- 3. 用户会话表 (user_sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "session_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "token" varchar(255) NOT NULL,
  "refresh_token" varchar(255),
  "device_info" text,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "expires_at" datetime NOT NULL,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "last_active_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT "UQ_ff5db00dec0f61218cd0d468df0" UNIQUE ("token"),
  CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_e9658e959c490b0a634dfc5478" ON "user_sessions" ("user_id");

-- ============================================
-- 4. 刷新令牌黑名单 (refresh_token_blacklist)
-- ============================================
CREATE TABLE IF NOT EXISTS "refresh_token_blacklist" (
  "token_jti" varchar(255) PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "revoked_at" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "reason" varchar(50),
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 5. 订阅计划表 (subscription_plans)
-- ============================================
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "plan_id" varchar PRIMARY KEY NOT NULL,
  "plan_code" varchar(50) NOT NULL,
  "plan_name" varchar(100) NOT NULL,
  "description" text,
  "price_monthly" decimal(10,2),
  "price_yearly" decimal(10,2),
  "currency" varchar(10) NOT NULL DEFAULT 'CNY',
  "features" text NOT NULL DEFAULT ('[]'),
  "quotas" text NOT NULL DEFAULT ('{}'),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "UQ_3679d2313bfaf654eb1bc25eae2" UNIQUE ("plan_code")
);

-- ============================================
-- 6. 订单表 (orders)
-- ============================================
CREATE TABLE IF NOT EXISTS "orders" (
  "order_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "plan_id" varchar,
  "order_no" varchar(100) NOT NULL,
  "order_type" varchar(20) NOT NULL DEFAULT 'subscription',
  "amount" decimal(10,2) NOT NULL,
  "currency" varchar(10) NOT NULL DEFAULT 'CNY',
  "discount_amount" decimal(10,2) NOT NULL DEFAULT 0,
  "final_amount" decimal(10,2) NOT NULL,
  "payment_method" varchar(20) NOT NULL DEFAULT 'wechat',
  "payment_status" varchar(20) NOT NULL DEFAULT 'pending',
  "paid_at" datetime,
  "payment_details" text,
  "period_start" date,
  "period_end" date,
  "refund_info" text,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "UQ_035026a83bef9740d7ad05df383" UNIQUE ("order_no"),
  CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- 7. 股票基础信息表 (stocks)
-- ============================================
CREATE TABLE IF NOT EXISTS "stocks" (
  "stock_id" varchar PRIMARY KEY NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "exchange" varchar(10),
  "industry" varchar(50),
  "sector" varchar(50),
  "market_cap" decimal(18,2),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "metadata" text NOT NULL DEFAULT ('{}'),
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "UQ_abdd997b009437486baf7531854" UNIQUE ("symbol")
);

CREATE INDEX IF NOT EXISTS "IDX_abdd997b009437486baf753185" ON "stocks" ("symbol");

-- ============================================
-- 8. 市场数据表 (market_data)
-- ============================================
CREATE TABLE IF NOT EXISTS "market_data" (
  "data_id" varchar PRIMARY KEY NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "name" varchar(100),
  "security_type" varchar(20) NOT NULL DEFAULT 'stock',
  "exchange" varchar(20),
  "sector" varchar(50),
  "industry" varchar(50),
  "currency" varchar(10) NOT NULL DEFAULT 'CNY',
  "market_cap" decimal(18,2),
  "open_price" decimal(18,6),
  "high_price" decimal(18,6),
  "low_price" decimal(18,6),
  "close_price" decimal(18,6),
  "volume" decimal(18,2),
  "turnover" decimal(18,2),
  "trade_date" date NOT NULL,
  "trade_time" time,
  "metadata" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_be6b3945a1870177d2435f92af" ON "market_data" ("trade_date");

-- ============================================
-- 9. 财务数据表 (financial_data)
-- ============================================
CREATE TABLE IF NOT EXISTS "financial_data" (
  "financial_id" varchar PRIMARY KEY NOT NULL,
  "stock_id" varchar NOT NULL,
  "report_period" varchar(10) NOT NULL,
  "report_type" varchar(10) NOT NULL DEFAULT 'annual',
  "revenue" decimal(18,2),
  "net_profit" decimal(18,2),
  "operating_profit" decimal(18,2),
  "total_assets" decimal(18,2),
  "total_liabilities" decimal(18,2),
  "shareholders_equity" decimal(18,2),
  "operating_cash_flow" decimal(18,2),
  "free_cash_flow" decimal(18,2),
  "eps" decimal(10,4),
  "book_value_per_share" decimal(10,4),
  "dividend_per_share" decimal(10,4),
  "roe" decimal(10,4),
  "roa" decimal(10,4),
  "debt_to_equity" decimal(10,4),
  "current_ratio" decimal(10,4),
  "pe_ratio" decimal(10,4),
  "pb_ratio" decimal(10,4),
  "ps_ratio" decimal(10,4),
  "ev_ebitda" decimal(10,4),
  "revenue_growth_yoy" decimal(10,4),
  "profit_growth_yoy" decimal(10,4),
  "metadata" text NOT NULL DEFAULT ('{}'),
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "UQ_5ff00dfe35d5cf8e93a2d3bfdf8" UNIQUE ("stock_id", "report_period", "report_type"),
  CONSTRAINT "FK_d87dd56d0e9dc85a0c1917b1929" FOREIGN KEY ("stock_id") REFERENCES "stocks" ("stock_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_d87dd56d0e9dc85a0c1917b192" ON "financial_data" ("stock_id");

-- ============================================
-- 10. 投资组合表 (portfolios)
-- ============================================
CREATE TABLE IF NOT EXISTS "portfolios" (
  "portfolio_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "type" varchar(20) NOT NULL DEFAULT 'personal',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "settings" text NOT NULL DEFAULT ('{}'),
  "statistics" text,
  "deleted_at" datetime,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_57fba72db5ac40768b40f0ecfa1" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_a4866b07151564e3823cdcc520" ON "portfolios" ("type");
CREATE INDEX IF NOT EXISTS "IDX_57fba72db5ac40768b40f0ecfa" ON "portfolios" ("user_id");

-- ============================================
-- 11. 持仓表 (holdings)
-- ============================================
CREATE TABLE IF NOT EXISTS "holdings" (
  "holding_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "name" varchar(100),
  "security_type" varchar(20) NOT NULL DEFAULT 'stock',
  "exchange" varchar(20),
  "quantity" decimal(18,6) NOT NULL DEFAULT 0,
  "cost_price" decimal(18,6) NOT NULL DEFAULT 0,
  "current_price" decimal(18,6),
  "market_value" decimal(18,6),
  "weight" decimal(10,4),
  "weight_target" decimal(10,4),
  "unrealized_pnl" decimal(18,6),
  "realized_pnl" decimal(18,6),
  "sector" varchar(50),
  "industry" varchar(50),
  "region" varchar(50),
  "currency" varchar(10) NOT NULL DEFAULT 'CNY',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "metadata" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_2f4f9915c4b755588d01fee50be" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_2f4f9915c4b755588d01fee50b" ON "holdings" ("portfolio_id");
CREATE INDEX IF NOT EXISTS "IDX_6f3f6f1365d3c32c574e683ae1" ON "holdings" ("symbol");

-- ============================================
-- 12. 持仓限制表 (holding_limits)
-- ============================================
CREATE TABLE IF NOT EXISTS "holding_limits" (
  "limit_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "limit_type" varchar(20) NOT NULL,
  "target_symbol" varchar(20),
  "target_sector" varchar(50),
  "max_weight" decimal(10,4) NOT NULL,
  "max_value" decimal(18,4),
  "action_on_breach" varchar(20) NOT NULL DEFAULT 'warn',
  "is_active" boolean NOT NULL DEFAULT 1,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime,
  CONSTRAINT "CHK_max_weight" CHECK (max_weight BETWEEN 0 AND 1),
  CONSTRAINT "FK_577439eb954be2fbabe5df93b25" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ============================================
-- 13. VaR 计算结果表 (var_calculations)
-- ============================================
CREATE TABLE IF NOT EXISTS "var_calculations" (
  "var_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "calculation_type" varchar(20) NOT NULL,
  "confidence_level" decimal(5,4) NOT NULL,
  "time_horizon" integer NOT NULL,
  "distribution" varchar(20),
  "monte_carlo_iterations" integer,
  "random_seed" integer,
  "var_value" decimal(18,6) NOT NULL,
  "var_percentage" decimal(10,4),
  "expected_return" decimal(18,6),
  "expected_shortfall" decimal(18,6),
  "volatility" decimal(18,6),
  "calculation_time_ms" integer,
  "var_components" text NOT NULL DEFAULT ('[]'),
  "risk_factors" text NOT NULL DEFAULT ('[]'),
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "error_message" text,
  "data_source" varchar(50),
  "data_period" varchar(20),
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "calculated_at" datetime,
  CONSTRAINT "FK_57fba72db5ac40768b40f0ecfa1" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_57fba72db5ac40768b40f0ecfa" ON "var_calculations" ("portfolio_id");

-- ============================================
-- 14. VaR 组件表 (var_components)
-- ============================================
CREATE TABLE IF NOT EXISTS "var_components" (
  "component_id" varchar PRIMARY KEY NOT NULL,
  "var_id" varchar NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "contribution" decimal(18,4) NOT NULL,
  "percentage" decimal(10,6) NOT NULL,
  "risk_factor" varchar(50),
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_c4f0c0484ab699dd60bea01602" ON "var_components" ("var_id");

-- ============================================
-- 15. 压力测试情景表 (stress_scenarios)
-- ============================================
CREATE TABLE IF NOT EXISTS "stress_scenarios" (
  "scenario_id" varchar PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "scenario_type" varchar(20) NOT NULL,
  "params" text NOT NULL DEFAULT ('{}'),
  "historical_period_start" date,
  "historical_period_end" date,
  "historical_deviation" decimal(10,6),
  "is_builtin" boolean NOT NULL DEFAULT 0,
  "created_by" varchar,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime
);

-- ============================================
-- 16. 压力测试结果表 (stress_tests)
-- ============================================
CREATE TABLE IF NOT EXISTS "stress_tests" (
  "stress_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "scenario_name" varchar(100) NOT NULL,
  "scenario_type" varchar(20) NOT NULL DEFAULT 'historical',
  "parameters" text NOT NULL DEFAULT ('{}'),
  "portfolio_value" decimal(18,6),
  "stressed_value" decimal(18,6),
  "loss_amount" decimal(18,6),
  "loss_percentage" decimal(10,4),
  "asset_results" text NOT NULL DEFAULT ('[]'),
  "risk_changes" text NOT NULL DEFAULT ('{}'),
  "test_date" datetime NOT NULL,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "CHK_loss_percentage" CHECK (loss_percentage BETWEEN -100 AND 0),
  CONSTRAINT "FK_5cbf54ae6a565dde492cc561ed4" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_5cbf54ae6a565dde492cc561ed" ON "stress_tests" ("portfolio_id");

-- ============================================
-- 17. 监控配置表 (monitor_configs) - config_name 兼容 (MON-001)
-- ============================================
CREATE TABLE IF NOT EXISTS "monitor_configs" (
  "config_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "config_name" varchar(100) NOT NULL,
  "monitor_type" varchar(20) NOT NULL,
  "threshold" decimal(18,6) NOT NULL,
  "operator" varchar(10) NOT NULL DEFAULT '>',
  "metrics" text NOT NULL DEFAULT ('{}'),
  "check_interval_seconds" integer NOT NULL DEFAULT 30,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "notification" text NOT NULL DEFAULT ('{}'),
  "rules" text NOT NULL DEFAULT ('{}'),
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  "last_triggered" datetime,
  "trigger_count" integer NOT NULL DEFAULT 0,
  "cooling_period_minutes" integer NOT NULL DEFAULT 5,
  CONSTRAINT "FK_7eb986ad5f06622a671abe0a8f0" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_65f241b3a10d5a8434e36094df3" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_65f241b3a10d5a8434e36094df" ON "monitor_configs" ("portfolio_id");
CREATE INDEX IF NOT EXISTS "IDX_7eb986ad5f06622a671abe0a8f" ON "monitor_configs" ("user_id");

-- ============================================
-- 18. 监控快照表 (monitor_snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS "monitor_snapshots" (
  "snapshot_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "monitor_type" varchar(50),
  "metric_value" decimal(18,6),
  "threshold_value" decimal(18,6),
  "operator" varchar(10),
  "holdings_risk" text,
  "extra_metrics" text,
  "snapshot_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_eea4e954813b4d1060040ed09cc" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_eea4e954813b4d1060040ed09c" ON "monitor_snapshots" ("portfolio_id");

-- ============================================
-- 19. 预警规则表 (alert_rules)
-- ============================================
CREATE TABLE IF NOT EXISTS "alert_rules" (
  "rule_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "rule_name" varchar(100) NOT NULL,
  "rule_type" varchar(20) NOT NULL,
  "monitor_type" varchar(20) NOT NULL,
  "threshold" decimal(18,6) NOT NULL,
  "operator" varchar(10) NOT NULL DEFAULT '>',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "notification_config" text NOT NULL DEFAULT ('{}'),
  "rules" text NOT NULL DEFAULT ('{}'),
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_50b6fe6b7247a43c503f0ccd4c3" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_28f424f9442043318dd4f8a4f58" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- 20. 预警记录表 (alert_history)
-- ============================================
CREATE TABLE IF NOT EXISTS "alert_history" (
  "history_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "rule_id" varchar,
  "user_id" varchar NOT NULL,
  "alert_type" varchar(20) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text,
  "trigger_details" text NOT NULL DEFAULT ('{}'),
  "notification_status" text NOT NULL DEFAULT ('{}'),
  "triggered_at" datetime NOT NULL,
  "resolved_at" datetime,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "notification_latency_ms" integer,
  CONSTRAINT "FK_4a9060d197d1bfbf6a1c2b09d9d" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_95048d503befe40e467d550713a" FOREIGN KEY ("rule_id") REFERENCES "alert_rules" ("rule_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_3245cf316413416555589fcfcea" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- 21. 市场风险预警表 (market_risk_alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS "market_risk_alerts" (
  "alert_id" varchar PRIMARY KEY NOT NULL,
  "index_symbol" varchar(20) NOT NULL,
  "index_name" varchar(50) NOT NULL,
  "previous_close" decimal(18,4) NOT NULL,
  "current_close" decimal(18,4) NOT NULL,
  "change_percentage" decimal(10,6) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "pushed_count" integer NOT NULL DEFAULT 0,
  "acknowledged_count" integer NOT NULL DEFAULT 0,
  "triggered_at" datetime NOT NULL,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_f1ede6fbc6e83a4e2ecfdac9e2" ON "market_risk_alerts" ("index_symbol");

-- ============================================
-- 22. 市场风险预警确认表 (market_risk_alert_acknowledgments)
-- ============================================
CREATE TABLE IF NOT EXISTS "market_risk_alert_acknowledgments" (
  "id" varchar PRIMARY KEY NOT NULL,
  "alert_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "acknowledged_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_39e4731704256c44d4c9a8031ab" FOREIGN KEY ("alert_id") REFERENCES "market_risk_alerts" ("alert_id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_04f3d060e4741793a1cd3903343" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ============================================
-- 23. 市场风险预警模板表 (market_risk_alert_templates)
-- ============================================
CREATE TABLE IF NOT EXISTS "market_risk_alert_templates" (
  "template_id" varchar PRIMARY KEY NOT NULL,
  "index_symbol" varchar(20) NOT NULL,
  "index_name" varchar(50) NOT NULL,
  "title_template" varchar(200) NOT NULL,
  "message_template" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT 1,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_a7e5bb181049706621d348c904" ON "market_risk_alert_templates" ("index_symbol");

-- ============================================
-- 24. 市场快照缓存表 (market_snapshot_cache)
-- ============================================
CREATE TABLE IF NOT EXISTS "market_snapshot_cache" (
  "symbol" varchar(20) NOT NULL,
  "snapshot_type" varchar(20) NOT NULL,
  "data_json" text NOT NULL,
  "fetched_at" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY ("symbol", "snapshot_type")
);

-- ============================================
-- 25. 计算缓存表 (computation_cache)
-- ============================================
CREATE TABLE IF NOT EXISTS "computation_cache" (
  "cache_key" text PRIMARY KEY NOT NULL,
  "result_json" text NOT NULL,
  "computation_type" varchar(50) NOT NULL,
  "param_hash" text NOT NULL,
  "computed_at" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "hit_count" integer NOT NULL DEFAULT 0,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 26. 数据导出请求表 (data_export_requests)
-- ============================================
CREATE TABLE IF NOT EXISTS "data_export_requests" (
  "export_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "format" varchar(20) NOT NULL,
  "include_tables" text,
  "file_path" varchar(500),
  "file_size" bigint,
  "checksum" varchar(64),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "error_message" text,
  "expires_at" datetime NOT NULL,
  "generated_at" datetime,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_df32d2c16d5db8fca41c2f2f066" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_df32d2c16d5db8fca41c2f2f06" ON "data_export_requests" ("user_id");

-- ============================================
-- 27. 消息队列表 (message_queue)
-- ============================================
CREATE TABLE IF NOT EXISTS "message_queue" (
  "message_id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "queue_name" varchar(50) NOT NULL,
  "payload" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "priority" integer NOT NULL DEFAULT 5,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "scheduled_at" integer NOT NULL,
  "created_at" integer NOT NULL DEFAULT 0,
  "processed_at" integer,
  "completed_at" integer,
  "error_message" text
);

-- ============================================
-- 28. 优化结果表 (optimization_results)
-- ============================================
CREATE TABLE IF NOT EXISTS "optimization_results" (
  "optimization_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "method" varchar(50) NOT NULL,
  "current_portfolio" text,
  "optimized_portfolio" text,
  "suggestions" text,
  "backtest_data" text,
  "disclaimer" text,
  "compliance_note" text,
  "risk_constraints" text,
  "has_investment_keywords" boolean NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "error_message" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_3f73a5e0905a80144ee6b9f9597" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ============================================
-- 29. 组合快照表 (portfolio_snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
  "snapshot_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "snapshot_date" date NOT NULL,
  "total_market_value" decimal(18,4),
  "total_cost" decimal(18,4),
  "daily_return" decimal(10,6),
  "cumulative_return" decimal(10,6),
  "holdings_snapshot" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_de294421d3b9ba2ba8dc665badd" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_de294421d3b9ba2ba8dc665bad" ON "portfolio_snapshots" ("portfolio_id");

-- ============================================
-- 30. 组合摘要缓存表 (portfolio_summary_cache)
-- ============================================
CREATE TABLE IF NOT EXISTS "portfolio_summary_cache" (
  "portfolio_id" varchar PRIMARY KEY NOT NULL,
  "summary_json" text NOT NULL,
  "total_market_value" decimal(18,6),
  "var_95_1d" decimal(18,6),
  "max_drawdown" decimal(18,6),
  "updated_at" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 31. 报告表 (reports)
-- ============================================
CREATE TABLE IF NOT EXISTS "reports" (
  "report_id" varchar PRIMARY KEY NOT NULL,
  "portfolio_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "report_name" varchar(200) NOT NULL,
  "report_type" varchar(20) NOT NULL DEFAULT 'var',
  "period_start" date,
  "period_end" date,
  "report_content" text NOT NULL DEFAULT ('{}'),
  "report_url" varchar(500),
  "file_format" varchar(10) NOT NULL DEFAULT 'pdf',
  "file_size" integer,
  "status" varchar(20) NOT NULL DEFAULT 'generated',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "generated_at" datetime,
  "expires_at" datetime,
  CONSTRAINT "FK_7a0697cd6847b6ceadfc9a45354" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios" ("portfolio_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- 32. 系统配置表 (system_configs)
-- ============================================
CREATE TABLE IF NOT EXISTS "system_configs" (
  "config_id" varchar PRIMARY KEY NOT NULL,
  "config_key" varchar(100) NOT NULL,
  "config_value" text NOT NULL,
  "config_type" varchar(20) NOT NULL DEFAULT 'system',
  "description" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "UQ_8430d4ebdc1faef3d3eeef36e87" UNIQUE ("config_key")
);

-- ============================================
-- 33. 工具 VaR 历史表 (tool_var_history)
-- ============================================
CREATE TABLE IF NOT EXISTS "tool_var_history" (
  "history_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "method" varchar(50) NOT NULL,
  "confidence_level" decimal(10,4) NOT NULL,
  "time_horizon" integer NOT NULL,
  "monte_carlo_iterations" integer,
  "distribution" varchar(50),
  "var_value" decimal(18,4) NOT NULL,
  "var_percentage" decimal(10,6) NOT NULL,
  "expected_return" decimal(18,4),
  "volatility" decimal(10,6),
  "holdings" text,
  "components" text,
  "risk_factors" text,
  "random_seed" integer,
  "calculation_time_ms" decimal(10,3),
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "error_message" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_c12c6b475046eae01e01b0995f" ON "tool_var_history" ("user_id");

-- ============================================
-- 34. 估值记录表 (valuation_records)
-- ============================================
CREATE TABLE IF NOT EXISTS "valuation_records" (
  "valuation_id" varchar PRIMARY KEY NOT NULL,
  "stock_id" varchar NOT NULL,
  "user_id" varchar,
  "method" varchar(20) NOT NULL,
  "inputs" text NOT NULL DEFAULT ('{}'),
  "result_value" decimal(18,4),
  "result_range_low" decimal(18,4),
  "result_range_high" decimal(18,4),
  "confidence_level" decimal(5,4),
  "assumptions" text NOT NULL DEFAULT ('{}'),
  "sensitivity_analysis" text NOT NULL DEFAULT ('{}'),
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_a37f89ec26187ee80c71c5ff64e" FOREIGN KEY ("stock_id") REFERENCES "stocks" ("stock_id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_65275b7f30d3a84573b1699b448" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_a37f89ec26187ee80c71c5ff64" ON "valuation_records" ("stock_id");

-- ============================================
-- 35. 匿名化日志表 (anonymization_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS "anonymization_logs" (
  "log_id" varchar PRIMARY KEY NOT NULL,
  "table_name" varchar(50) NOT NULL,
  "records_processed" integer NOT NULL,
  "anonymization_type" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'running',
  "error_message" text,
  "started_at" datetime NOT NULL,
  "completed_at" datetime,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 36. 审计日志表 (audit_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "log_id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar,
  "operation_type" varchar(50) NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" varchar,
  "details" text NOT NULL DEFAULT ('{}'),
  "ip_address" varchar(50),
  "user_agent" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- 37. 分区元数据表 (partition_metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS "partition_metadata" (
  "metadata_id" varchar PRIMARY KEY NOT NULL,
  "table_type" varchar(50) NOT NULL,
  "partition_name" varchar(20) NOT NULL,
  "partition_start" date NOT NULL,
  "partition_end" date NOT NULL,
  "record_count" bigint NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "archived_at" datetime
);

-- ============================================
-- 38. 管理员审批请求表 (admin_approval_requests)
-- ============================================
CREATE TABLE IF NOT EXISTS "admin_approval_requests" (
  "request_id" varchar PRIMARY KEY NOT NULL,
  "requester_id" varchar NOT NULL,
  "approver_id" varchar,
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(50),
  "resource_id" varchar,
  "before_value" text,
  "after_value" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "requested_at" datetime NOT NULL DEFAULT (datetime('now')),
  "approved_at" datetime,
  "rejected_at" datetime,
  "rejection_reason" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "execution_error" text,
  "cancelled_at" datetime,
  CONSTRAINT "FK_c7cf76c85deacb1fb4f2f8db2ff" FOREIGN KEY ("requester_id") REFERENCES "users" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IDX_c7cf76c85deacb1fb4f2f8db2f" ON "admin_approval_requests" ("requester_id");

-- ============================================
-- 39. 帮助内容表 (help_content)
-- ============================================
CREATE TABLE IF NOT EXISTS "help_content" (
  "content_id" varchar PRIMARY KEY NOT NULL,
  "topic" varchar(50) NOT NULL,
  "category" varchar(20) NOT NULL DEFAULT 'general',
  "status" varchar(20) NOT NULL DEFAULT 'published',
  "tags" text,
  "format" varchar(20) NOT NULL DEFAULT 'markdown',
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "content_type" varchar(20) NOT NULL DEFAULT 'markdown',
  "video_url" varchar(500),
  "images" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "related_topics" text,
  "is_active" boolean NOT NULL DEFAULT 1,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime
);

-- ============================================
-- 视图
-- ============================================

CREATE VIEW IF NOT EXISTS portfolio_overview AS
SELECT p.portfolio_id, p.name, p.status, p.user_id,
       COUNT(h.holding_id) as holding_count,
       COALESCE(SUM(h.market_value), 0) as total_value
FROM portfolios p
LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
WHERE p.status = 'active'
GROUP BY p.portfolio_id;

CREATE VIEW IF NOT EXISTS risk_summary AS
SELECT p.portfolio_id, p.name, p.user_id,
       v.var_value, v.var_percentage, v.confidence_level, v.calculation_type, v.calculated_at
FROM portfolios p
LEFT JOIN var_calculations v ON p.portfolio_id = v.portfolio_id
WHERE p.status = 'active';

CREATE VIEW IF NOT EXISTS monitor_status AS
SELECT m.config_id as monitor_id, m.portfolio_id, m.config_name as monitor_name, m.monitor_type, m.status, m.threshold, m.operator,
       COUNT(h.history_id) as active_alerts
FROM monitor_configs m
LEFT JOIN alert_history h ON m.portfolio_id = h.portfolio_id AND h.status = 'active'
WHERE m.status = 'active'
GROUP BY m.config_id;

-- ============================================
-- 种子数据 - 股票基础信息 (TASK-001)
-- ============================================
INSERT OR IGNORE INTO "stocks" ("stock_id", "symbol", "name", "exchange", "sector", "industry", "status")
VALUES
  ('stock-001', '600519.SH', '贵州茅台', 'SSE', '消费品', '白酒', 'active'),
  ('stock-002', '000858.SZ', '五粮液', 'SZSE', '消费品', '白酒', 'active'),
  ('stock-003', '300750.SZ', '宁德时代', 'SZSE', '工业', '电池', 'active'),
  ('stock-004', '601318.SH', '中国平安', 'SSE', '金融', '保险', 'active'),
  ('stock-005', '000333.SZ', '美的集团', 'SZSE', '家电', '家用电器', 'active'),
  ('stock-006', '510300.SH', '沪深300ETF', 'SSE', '指数', 'ETF', 'active');

-- ============================================
-- 种子数据 - 市场行情数据 (TASK-001)
-- ============================================
INSERT OR IGNORE INTO "market_data" ("data_id", "symbol", "name", "exchange", "sector", "industry", "close_price", "open_price", "high_price", "low_price", "volume", "trade_date")
VALUES
  ('md-001', '600519.SH', '贵州茅台', 'SSE', '消费品', '白酒', 1680.00, 1670.00, 1690.00, 1665.00, 25000, date('now')),
  ('md-002', '000858.SZ', '五粮液', 'SZSE', '消费品', '白酒', 158.00, 156.00, 160.00, 155.00, 450000, date('now')),
  ('md-003', '300750.SZ', '宁德时代', 'SZSE', '工业', '电池', 210.00, 208.00, 215.00, 205.00, 320000, date('now')),
  ('md-004', '601318.SH', '中国平安', 'SSE', '金融', '保险', 48.00, 47.50, 48.50, 47.20, 890000, date('now')),
  ('md-005', '000333.SZ', '美的集团', 'SZSE', '家电', '家用电器', 58.50, 58.00, 59.00, 57.80, 120000, date('now')),
  ('md-006', '510300.SH', '沪深300ETF', 'SSE', '指数', 'ETF', 4.20, 4.15, 4.25, 4.12, 5000000, date('now'));

-- ============================================
-- 默认订阅计划数据
-- ============================================
INSERT OR IGNORE INTO "subscription_plans" ("plan_id", "plan_code", "plan_name", "description", "price_monthly", "price_yearly", "features", "quotas", "status")
VALUES
  ('free-plan', 'free', '免费版', '基础功能，适合初学者体验', 0, 0,
   '["basic_var", "basic_report", "single_portfolio", "daily_monitoring", "email_support", "pe_pb_valuation"]',
   '{"max_portfolios": 1, "max_holdings": 5, "var_calculations_per_day": 3, "valuation_per_day": 3, "data_history_months": 3, "max_monitors": 3}',
   'active'),
  ('pro-plan', 'professional', '专业版', '高级功能，适合活跃投资者', 29, 278,
   '["advanced_var", "advanced_report", "multiple_portfolios", "realtime_monitoring", "stress_test", "optimization", "priority_email_support", "dcf_ddm_peg_valuation", "pdf_excel_export", "5y_history"]',
   '{"max_portfolios": 5, "max_holdings": 50, "var_calculations_per_day": -1, "valuation_per_day": -1, "data_history_months": 60, "max_monitors": 20}',
   'active'),
  ('vip-plan', 'vip', 'VIP版', '全功能，适合专业投资者', 99, 950,
   '["enterprise_var", "custom_report", "unlimited_portfolios", "advanced_monitoring", "stress_test", "optimization", "ai_valuation", "priority_support", "dedicated_manager", "10y_history", "custom_template"]',
   '{"max_portfolios": -1, "max_holdings": -1, "var_calculations_per_day": -1, "valuation_per_day": -1, "data_history_months": 120, "max_monitors": -1}',
   'active');

-- ============================================
-- 默认系统配置数据
-- ============================================
INSERT OR IGNORE INTO "system_configs" ("config_id", "config_key", "config_value", "config_type", "description")
VALUES
  ('cfg-market-source', 'market_data_source', '{"primary": "tushare", "backup": "yahoo", "update_frequency": "daily"}', 'system', '市场数据源配置'),
  ('cfg-var-defaults', 'var_calculation_defaults', '{"confidence_level": 0.95, "time_horizon": 1, "method": "historical", "data_period": "1y", "min_history_days": 252}', 'system', 'VaR计算默认参数'),
  ('cfg-risk-thresholds', 'risk_thresholds', '{"var_warning": 0.05, "var_critical": 0.10, "concentration_warning": 0.30, "concentration_critical": 0.50, "drawdown_warning": 0.15, "drawdown_critical": 0.25}', 'system', '风险阈值配置'),
  ('cfg-notification', 'notification_settings', '{"enabled": true, "channels": ["app", "email"], "cooldown_minutes": 30, "max_daily_emails": 10}', 'system', '通知系统配置'),
  ('cfg-system-status', 'system_status', '{"maintenance_mode": false, "version": "1.2.0", "release_date": "2026-07-12", "features": ["var", "stress_test", "monitoring"]}', 'system', '系统状态信息'),
  ('cfg-rate-limits', 'rate_limits', '{"api_per_minute": 60, "auth_per_minute": 5, "calc_per_minute": 10, "report_per_hour": 5}', 'system', 'API限流配置'),
  ('cfg-security', 'security_settings', '{"password_min_length": 12, "require_special_char": true, "max_login_attempts": 5, "lockout_duration_minutes": 30, "session_timeout_hours": 24}', 'security', '安全设置'),
  ('cfg-data-retention', 'data_retention', '{"var_history_days": 365, "alert_history_days": 90, "log_history_days": 1095, "report_history_days": 365, "deleted_user_grace_days": 30}', 'system', '数据保留策略');

-- ============================================
-- 完成
-- ============================================
SELECT 'PRME SQLite database v4.0 initialized successfully!' as status;
