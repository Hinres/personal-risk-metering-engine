# 数据库完善总结

## 完善内容

### 1. SQL Schema 增强 (`database/init.sql`)

#### 新增扩展
- `pg_trgm` - 模糊搜索支持
- `btree_gin` - GIN索引
- `pgcrypto` - 加密函数

#### 新增字段
| 表 | 新增字段 | 用途 |
|----|---------|------|
| users | deleted_at, deleted_by, login_count, metadata | 软删除、审计 |
| portfolios | deleted_at, settings.benchmark | 软删除、基准对比 |
| holdings | weight_target, status, metadata | 再平衡目标、状态管理 |
| market_data | adj_close, change_amount, change_percent, technical_indicators | 复权价格、技术指标 |
| var_calculations | expected_shortfall, calculated_by | ES/CVaR、操作人 |
| stress_tests | scenario_id, var_before, var_after, tested_by | 情景ID、VaR对比 |
| risk_monitors | trigger_count, notification.quiet_hours | 触发统计、静默时间 |
| alert_records | resolved_by, resolution_notes | 解决人、备注 |
| risk_reports | file_hash, is_shared, share_token, share_expires_at, generated_by | 文件校验、分享 |
| system_configs | version, is_encrypted, updated_by | 版本控制、加密 |
| operation_logs | old_data, new_data, request_id, execution_time_ms | 变更对比、性能 |
| orders | transaction_id, duration_months, invoice_required, invoice_info | 交易ID、发票 |
| user_sessions | token_hash, location, refresh_expires_at, last_request_path, last_request_method | 安全、追踪 |

#### 新增索引（性能优化）
- 复合索引：`idx_portfolios_user_status`, `idx_var_calculations_portfolio_date`
- 部分索引：`idx_users_status` (WHERE status != 'deleted')
- 模糊搜索：`idx_users_username_trgm` (GIN trigram)
- JSONB索引：`idx_users_preferences` (GIN)

#### 新增触发器
1. `check_var_after_insert` - VaR计算后自动检查阈值并触发预警
2. `holdings_change_update_stats` - 持仓变动后自动更新组合统计
3. `audit_users` - 用户表审计日志
4. `audit_portfolios` - 组合表审计日志

#### 新增函数
1. `calculate_portfolio_statistics()` - 计算组合统计信息
2. `check_var_threshold()` - 检查VaR阈值
3. `audit_log()` - 通用审计日志
4. `cleanup_expired_data()` - 清理过期数据
5. `get_db_stats()` - 获取数据库统计

#### 新增视图
1. `portfolio_overview` - 组合概览（含持仓统计）
2. `risk_summary` - 风险摘要（含最新VaR、预警）
3. `user_subscription_status` - 用户订阅状态（含过期检查）
4. `monitor_status` - 监控规则状态（含预警计数）

#### 默认数据增强
- 订阅计划增加 sort_order 字段
- 系统配置增加 rate_limits, security_settings, data_retention

### 2. TypeORM 模型完善

#### 新增特性
- 软删除：`@DeleteDateColumn` 支持
- 关系映射：`@OneToMany`, `@ManyToOne`, `@JoinColumn`
- 索引装饰器：`@Index()`
- 级联删除配置

#### 实体关系图
```
User ||--o{ Portfolio : owns
User ||--o{ RiskMonitor : configures
User ||--o{ AlertRecord : receives
User ||--o{ Order : places
User ||--o{ UserSession : has

Portfolio ||--o{ Holding : contains
Portfolio ||--o{ VaRCalculation : has
Portfolio ||--o{ StressTest : tested
Portfolio ||--o{ RiskMonitor : monitored
Portfolio ||--o{ AlertRecord : generates
Portfolio ||--o{ RiskReport : produces
```

### 3. 数据库工具函数

#### 查询构建器辅助函数
- `buildPaginationQuery()` - 分页查询构建
- `buildFilterQuery()` - 筛选条件构建
- `buildSortQuery()` - 排序构建

#### JSONB 查询助手
- `jsonbContains()` - JSONB包含查询
- `jsonbPathQuery()` - JSONB路径查询
- `jsonbMerge()` - JSONB合并更新

### 4. 性能优化

#### 索引策略
- B-Tree索引：等值查询、范围查询
- GIN索引：JSONB字段、模糊搜索
- 复合索引：多字段联合查询
- 部分索引：带条件的查询优化

#### 查询优化
- 视图物化建议（大量数据时）
- 分区表建议（market_data按日期分区）
- 连接查询优化

### 5. 数据安全

#### 审计机制
- 自动记录所有数据变更
- 保留变更前后快照
- 支持用户操作追踪

#### 数据清理
- 自动清理过期日志（180天）
- 自动清理过期会话（7天）
- 自动清理已解决预警（90天）

## 使用建议

### 1. 初始化数据库
```bash
psql -h localhost -U postgres -d personal_risk_metering_engine -f database/init.sql
```

### 2. 定期维护
```sql
-- 清理过期数据
SELECT cleanup_expired_data();

-- 查看数据库统计
SELECT get_db_stats();

-- 更新组合统计
SELECT calculate_portfolio_statistics('portfolio-uuid-here');
```

### 3. 性能监控
```sql
-- 查看表大小
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看索引使用情况
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

## 后续优化建议

1. **分区表**：market_data表建议按trade_date进行范围分区
2. **物化视图**：portfolio_overview/risk_summary数据量大时建议物化
3. **读写分离**：生产环境建议配置主从复制
4. **缓存层**：热点数据建议加Redis缓存
5. **连接池**：TypeORM连接池参数调优
