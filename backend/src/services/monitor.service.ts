/**
 * [PRME-RM-001] 实时风险监控
 * 文件: monitor.service.ts
 * 需求描述: 实时风险监控功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { MonitorConfig } from '../models/MonitorConfig';
import { AlertHistory } from '../models/AlertHistory';
import { VaRCalculation } from '../models/VaRCalculation';
import { PortfolioSummaryCache } from '../models/PortfolioSummaryCache';
import { StopLossSuggestion } from '../models/StopLossSuggestion';
import { RiskEventImpact } from '../models/RiskEventImpact';
import { VaRService } from './var.service';
import { NotificationService } from './notification.service';
import { StopLossService } from './stopLoss.service';
import { RiskEventService } from './riskEvent.service';
import { MarketVolatilityService } from './marketVolatility.service';
import { MarketDataService } from './marketData.service';
import { PortfolioService } from './portfolio.service';
import { MarketData } from '../models/MarketData';
import { Holding } from '../models/Holding';
import WebSocketService from './websocket.service';
import logger from '../utils/logger';

const monitorRepo = () => AppDataSource.getRepository(MonitorConfig);
const alertRepo = () => AppDataSource.getRepository(AlertHistory);
const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const cacheRepo = () => AppDataSource.getRepository(PortfolioSummaryCache);
const stopLossRepo = () => AppDataSource.getRepository(StopLossSuggestion);
const impactRepo = () => AppDataSource.getRepository(RiskEventImpact);
const marketDataRepo = () => AppDataSource.getRepository(MarketData);
const holdingRepo = () => AppDataSource.getRepository(Holding);

// DEF-V131-003 / V2-02：监控类型支持矩阵（单一事实源）
// 阈值型监控指标（getMetricValue 有实现）
const SUPPORTED_METRIC_TYPES = new Set([
  'var', 'var_threshold', 'var_percentage',
  'cvar', 'expected_shortfall', 'es',
  'volatility', 'vol',
  'max_drawdown', 'drawdown', 'mdd',
  // V2-02：流动性 / 集中度
  'liquidity',
  'concentration', 'hhi',
]);
// 专用型监控（走 checkSpecializedMonitor，不走指标阈值）
const SPECIALIZED_MONITOR_TYPES = new Set(['stop_loss', 'risk_event', 'volatility_spike']);

export function isSupportedMonitorType(t: string): boolean {
  const n = (t || '').toLowerCase().trim();
  return SUPPORTED_METRIC_TYPES.has(n) || SPECIALIZED_MONITOR_TYPES.has(n);
}

/** 不支持类型的统一报错文案（DEF-V131-003） */
function unsupportedMonitorTypeError(type: string): Error {
  return Object.assign(
    new Error(`UNSUPPORTED_METRIC_TYPE: 不支持的风险监控类型 "${type}"。当前支持：VaR / CVaR / 波动率 / 最大回撤 / 流动性 / 持仓集中度 / 止损 / 风险事件 / 波动率异常。`),
    { statusCode: 400 }
  );
}

export class MonitorService {
  static async getMonitors(userId: string, portfolioId?: string) {
    const where: any = { user_id: userId, status: 'active' };
    if (portfolioId) where.portfolio_id = portfolioId;
    const monitors = await monitorRepo().find({ where, order: { created_at: 'DESC' } });
    // 返回统一字段名
    return monitors.map(m => ({
      ...m,
      monitor_name: m.config_name,
      monitor_id: m.config_id,
    }));
  }

  /**
   * 获取单个监控规则详情（按 ID + 用户做权限校验）
   */
  static async getById(id: string, userId: string) {
    const monitor = await monitorRepo().findOne({ where: { config_id: id, user_id: userId, status: 'active' } });
    if (!monitor) return null;
    return {
      ...monitor,
      monitor_name: monitor.config_name,
      monitor_id: monitor.config_id,
    };
  }

  /** 兼容任务单中引用的方法名 */
  static async getMonitor(id: string, userId: string) {
    return this.getById(id, userId);
  }

  static async create(userId: string, data: any) {
    // DEF-V131-003：不支持的风险监控类型在创建入口直接拦截（400），不产生监控任务
    if (!isSupportedMonitorType(data.monitor_type)) {
      throw unsupportedMonitorTypeError(data.monitor_type);
    }

    // 处理 notification_channels / notification_methods 参数映射到 notification.channels
    let notification = data.notification || { enabled: true, channels: ['app'] };
    const channelsFromFrontend = data.notification_channels || data.notification_methods;
    if (channelsFromFrontend && Array.isArray(channelsFromFrontend)) {
      notification = {
        ...notification,
        enabled: true,
        channels: channelsFromFrontend,
      };
    }

    // ✅ 支持 config_name（PRD 命名）和 monitor_name（兼容旧调用）
    const name = data.config_name || data.monitor_name;

    // 归一化 PRD 字段名 threshold_value/comparison 到后端字段名 threshold/operator（DEF-001）
    const threshold = data.threshold_value !== undefined ? data.threshold_value : data.threshold;
    const operator = data.comparison !== undefined ? data.comparison : data.operator;

    // 处理前端 severity 字段映射：权威来源为 rules.severity（ARC-DESIGN-20260823-001）
    let rules = data.rules || {};
    if (data.severity !== undefined) {
      rules = { ...rules, severity: data.severity };
    }

    const monitor = monitorRepo().create({
      user_id: userId,
      portfolio_id: data.portfolio_id,
      config_name: name,
      monitor_type: data.monitor_type,
      threshold,
      operator: operator || '>',
      notification: notification,
      rules,
      // M-08: 支持多指标配置和自定义检查频率
      // v1.3 设计约束：severity 仅由 rules.severity 提供，不再保留 metrics.severity
      metrics: data.metrics || {},
      check_interval_seconds: data.check_interval_seconds || 30,
    });
    await monitorRepo().save(monitor);

    // 返回统一字段名：同时保留原字段和提供 monitor_name / monitor_id 别名
    const result = {
      ...monitor,
      monitor_name: monitor.config_name,
      monitor_id: monitor.config_id,
    };
    return result;
  }

  static async update(id: string, userId: string, data: any) {
    const monitor = await monitorRepo().findOne({ where: { config_id: id, user_id: userId, status: 'active' } });
    if (!monitor) throw new Error('Monitor not found');

    // DEF-V131-003：修改 monitor_type 时同样校验支持矩阵
    if (data.monitor_type !== undefined && !isSupportedMonitorType(data.monitor_type)) {
      throw unsupportedMonitorTypeError(data.monitor_type);
    }

    // 归一化前端字段名到后端实体字段名
    if (data.monitor_name !== undefined) {
      data.config_name = data.monitor_name;
    }
    if (data.threshold_value !== undefined) {
      data.threshold = data.threshold_value;
    }
    if (data.comparison !== undefined) {
      data.operator = data.comparison;
    }
    if (data.severity !== undefined) {
      data.rules = { ...(monitor.rules || {}), severity: data.severity };
      // v1.3: severity 单一权威来源为 rules.severity，不再同步写入 metrics
    }
    if (data.notification_methods !== undefined) {
      data.notification = {
        ...monitor.notification,
        enabled: true,
        channels: Array.isArray(data.notification_methods) ? data.notification_methods : [],
      };
    }

    // 清理已被显式映射的前端字段，避免作为非实体字段被 Object.assign
    delete data.monitor_name;
    delete data.threshold_value;
    delete data.comparison;
    delete data.severity;
    delete data.notification_methods;

    Object.assign(monitor, data);
    await monitorRepo().save(monitor);
    return {
      ...monitor,
      monitor_name: monitor.config_name,
      monitor_id: monitor.config_id,
    };
  }

  static async delete(id: string, userId: string) {
    const monitor = await monitorRepo().findOne({ where: { config_id: id, user_id: userId, status: 'active' } });
    if (!monitor) throw new Error('Monitor not found');
    monitor.status = 'deleted';
    await monitorRepo().save(monitor);
    return true;
  }

  static async checkAllMonitors() {
    const activeMonitors = await monitorRepo().find({ where: { status: 'active' } });
    for (const monitor of activeMonitors) {
      // 按 check_interval_seconds 控制检查频率
      if (monitor.check_interval_seconds && monitor.last_triggered) {
        const elapsedSeconds = (Date.now() - monitor.last_triggered.getTime()) / 1000;
        if (elapsedSeconds < monitor.check_interval_seconds) {
          continue; // 跳过，未到达检查间隔
        }
      }
      await this.checkMonitor(monitor);
    }
  }

  static async checkPortfolioMonitors(portfolioId: string) {
    const monitors = await monitorRepo().find({ where: { portfolio_id: portfolioId, status: 'active' } });
    for (const monitor of monitors) {
      // 按 check_interval_seconds 控制检查频率
      if (monitor.check_interval_seconds && monitor.last_triggered) {
        const elapsedSeconds = (Date.now() - monitor.last_triggered.getTime()) / 1000;
        if (elapsedSeconds < monitor.check_interval_seconds) {
          continue; // 跳过，未到达检查间隔
        }
      }
      await this.checkMonitor(monitor);
    }
  }

  private static async checkMonitor(monitor: MonitorConfig) {
    try {
      // v1.3: 止损/风险事件/波动率异常作为特殊监控类型，走专用检查分支
      const specializedType = (monitor.monitor_type || '').toLowerCase().trim();
      if (specializedType === 'stop_loss' || specializedType === 'risk_event' || specializedType === 'volatility_spike') {
        await this.checkSpecializedMonitor(monitor, specializedType);
        return;
      }

      // M-08: 优先检查 metrics 多指标配置，兼容单指标模式
      const metricsToCheck = this.resolveMetricsToCheck(monitor);
      if (metricsToCheck.length === 0) return;

      let anyTriggered = false;

      for (const metric of metricsToCheck) {
        // P1-5: 按指标类型获取实际值
        const actualValue = await this.getMetricValue(monitor.portfolio_id, metric.type);
        if (actualValue === null) {
          logger.debug(`Monitor ${monitor.config_id} metric ${metric.type} no data available, skipping`);
          continue;
        }

        const threshold = Number(metric.threshold);
        let triggered = false;
        switch (metric.operator) {
          case '>': triggered = actualValue > threshold; break;
          case '<': triggered = actualValue < threshold; break;
          case '>=': triggered = actualValue >= threshold; break;
          case '<=': triggered = actualValue <= threshold; break;
          case '=': triggered = actualValue === threshold; break;
        }

        if (triggered) {
          // P1-4: 冷却期检查 — 同一指标类型在冷却期内不重复告警
          const isCooling = await this.isInCoolingPeriod(monitor, metric.type);
          if (isCooling) {
            logger.debug(`Monitor ${monitor.config_id} metric ${metric.type} in cooling period, skipping`);
            continue;
          }
          anyTriggered = true;
          await this.triggerAlert(monitor, metric, actualValue, threshold);
        }
      }

      if (anyTriggered) {
        monitor.last_triggered = new Date();
        monitor.trigger_count += 1;
        await monitorRepo().save(monitor);
      }
    } catch (e: any) {
      logger.error(`Monitor check failed for ${monitor.config_id}: ${e.message}`);
    }
  }

  /**
   * v1.3: 专用检查分支，处理止损/风险事件/波动率异常等监控类型
   */
  private static async checkSpecializedMonitor(monitor: MonitorConfig, monitorType: string) {
    let result: { triggered: boolean; value: number; threshold: number; metricType: string; details?: any } | null = null;

    switch (monitorType) {
      case 'stop_loss':
        result = await this.checkStopLoss(monitor);
        break;
      case 'risk_event':
        result = await this.checkRiskEvent(monitor);
        break;
      case 'volatility_spike':
        result = await this.checkVolatilitySpike(monitor);
        break;
    }

    if (!result || !result.triggered) return;

    const isCooling = await this.isInCoolingPeriod(monitor, result.metricType);
    if (isCooling) {
      logger.debug(`Monitor ${monitor.config_id} ${result.metricType} in cooling period, skipping`);
      return;
    }

    const metric = { type: result.metricType, threshold: result.threshold, operator: '>' };
    await this.triggerAlert(monitor, metric, result.value, result.threshold);

    monitor.last_triggered = new Date();
    monitor.trigger_count += 1;
    await monitorRepo().save(monitor);
  }

  /**
   * 检查止损触发：当前价 < 止损参考价
   */
  private static async checkStopLoss(monitor: MonitorConfig) {
    const latest = await stopLossRepo().findOne({
      where: { portfolio_id: monitor.portfolio_id },
      order: { created_at: 'DESC' },
    });
    if (!latest) return { triggered: false, value: 0, threshold: 0, metricType: 'stop_loss' };

    let suggestions: any[] = [];
    try {
      suggestions = JSON.parse(latest.suggestions || '[]');
    } catch {
      suggestions = [];
    }

    let maxBreach = 0;
    const breached: any[] = [];
    for (const s of suggestions) {
      if (!s.symbol || s.symbol === 'portfolio') continue;
      const currentPrice = await MarketDataService.getLatestPrice(s.symbol);
      if (!currentPrice || !s.stop_loss_price) continue;
      const current = Number(currentPrice);
      const stopLoss = Number(s.stop_loss_price);
      if (current < stopLoss) {
        const breach = (stopLoss - current) / stopLoss;
        if (breach > maxBreach) maxBreach = breach;
        breached.push({ symbol: s.symbol, name: s.name, current, stop_loss_price: stopLoss, breach });
      }
    }

    return {
      triggered: maxBreach > 0,
      value: maxBreach,
      threshold: 0,
      metricType: 'stop_loss',
      details: { breached },
    };
  }

  /**
   * 检查风险事件：是否存在未通知的持仓匹配事件
   */
  private static async checkRiskEvent(monitor: MonitorConfig) {
    const where: any = { user_id: monitor.user_id, is_notified: false };
    if (monitor.portfolio_id) where.portfolio_id = monitor.portfolio_id;
    const count = await impactRepo().count({ where });
    return {
      triggered: count > 0,
      value: count,
      threshold: 0,
      metricType: 'risk_event',
    };
  }

  /**
   * 检查波动率异常：历史分位 > 80 且日环比上涨 > 10%
   */
  private static async checkVolatilitySpike(monitor: MonitorConfig) {
    try {
      const summary = await MarketVolatilityService.getCurrentVolatility();
      if (summary.historical_percentile <= 80) {
        return { triggered: false, value: 0, threshold: 80, metricType: 'volatility_spike' };
      }
      const previous = await MarketVolatilityService.getPreviousCompositeVolatility();
      if (!previous || previous <= 0) {
        return { triggered: false, value: 0, threshold: 80, metricType: 'volatility_spike' };
      }
      const dayChange = (summary.composite_volatility - previous) / previous;
      if (dayChange <= 0.10) {
        return { triggered: false, value: 0, threshold: 80, metricType: 'volatility_spike' };
      }
      return {
        triggered: true,
        value: summary.historical_percentile,
        threshold: 80,
        metricType: 'volatility_spike',
        details: { composite_volatility: summary.composite_volatility, day_change: dayChange },
      };
    } catch (e: any) {
      logger.error(`Volatility spike check failed for monitor ${monitor.config_id}: ${e.message}`);
      return { triggered: false, value: 0, threshold: 80, metricType: 'volatility_spike' };
    }
  }

  /**
   * P1-5: 按指标类型获取最新值
   * 支持 var, cvar/expected_shortfall, volatility, max_drawdown 等多种指标
   */
  private static async getMetricValue(portfolioId: string, metricType: string): Promise<number | null> {
    const type = metricType.toLowerCase().trim();

    try {
      switch (type) {
        case 'var':
        case 'var_threshold':
        case 'var_percentage': {
          // 优先使用 VaRService（向后兼容，兼容测试 mock）
          const latest = await VaRService.getLatest(portfolioId);
          return latest?.var_percentage !== null && latest?.var_percentage !== undefined
            ? Number(latest.var_percentage)
            : null;
        }
        case 'cvar':
        case 'expected_shortfall':
        case 'es': {
          const latest = await varRepo().findOne({
            where: { portfolio_id: portfolioId },
            order: { calculated_at: 'DESC' },
          });
          return latest?.expected_shortfall !== null && latest?.expected_shortfall !== undefined
            ? Number(latest.expected_shortfall)
            : null;
        }
        case 'volatility':
        case 'vol': {
          const latest = await varRepo().findOne({
            where: { portfolio_id: portfolioId },
            order: { calculated_at: 'DESC' },
          });
          return latest?.volatility !== null && latest?.volatility !== undefined
            ? Number(latest.volatility)
            : null;
        }
        case 'max_drawdown':
        case 'drawdown':
        case 'mdd': {
          // 优先从缓存表获取
          const cache = await cacheRepo().findOne({ where: { portfolio_id: portfolioId } });
          if (cache?.max_drawdown !== null && cache?.max_drawdown !== undefined) {
            return Number(cache.max_drawdown);
          }
          // 缓存中没有，尝试从 VaR 计算记录获取（可能通过 risk_factors 存储）
          const latest = await varRepo().findOne({
            where: { portfolio_id: portfolioId },
            order: { calculated_at: 'DESC' },
          });
          if (latest?.risk_factors && Array.isArray(latest.risk_factors)) {
            const mddFactor = latest.risk_factors.find((f: any) =>
              f?.factor_name === 'max_drawdown' || f?.factor_type === 'max_drawdown'
            );
            if (mddFactor?.value !== undefined) {
              return Number(mddFactor.value);
            }
          }
          return null;
        }
        // V2-02：组合流动性（变现天数估计，越小越好）
        case 'liquidity':
          return await this.getPortfolioLiquidityDays(portfolioId);

        // V2-02：持仓集中度（HHI，与 structure 端点同口径）
        case 'concentration':
        case 'hhi': {
          const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
          if (holdings.length === 0) return null;
          return PortfolioService.calculateHHI(holdings);
        }
        default: {
          // DEF-V131-003：未知指标不再静默回退 VaR（避免错误配置无感知）；防御存量脏数据
          logger.warn(`Unsupported metric type "${metricType}" for portfolio ${portfolioId}, returning null`);
          return null;
        }
      }
    } catch (e: any) {
      logger.error(`Failed to get metric value for ${metricType}: ${e.message}`);
      return null;
    }
  }

  /**
   * V2-02：组合流动性指标 —— 组合变现天数（持仓按市值全部卖出所需自然日估计，越小流动性越好）
   * 每只持仓：days_i = 持仓市值 / 近20交易日日均成交额（turnover），下限截断 0.01 天防除零；
   * 缺失行情或 turnover 为 0 → 该票按 fallback 10 天计（保守），记 warn；
   * 组合变现天数 = Σ(市值权重 × days_i)。无持仓/总市值 0 → null（skip 评估，同既有语义）。
   */
  private static async getPortfolioLiquidityDays(portfolioId: string): Promise<number | null> {
    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    if (holdings.length === 0) return null;

    const totalValue = holdings.reduce((sum, h) => sum + Number(h.market_value?.toString() || 0), 0);
    if (totalValue <= 0) return null;

    const FALLBACK_DAYS = 10;
    const MIN_DAYS = 0.01;
    let weightedDays = 0;

    for (const h of holdings) {
      const mv = Number(h.market_value?.toString() || 0);
      const weight = mv / totalValue;

      // 近 20 个交易日日均成交额
      const rows = await marketDataRepo()
        .createQueryBuilder('m')
        .select('AVG(m.turnover)', 'avg_turnover')
        .where('m.symbol = :symbol', { symbol: h.symbol })
        .andWhere('m.turnover IS NOT NULL')
        .andWhere('m.turnover > 0')
        .orderBy('m.trade_date', 'DESC')
        .limit(20)
        .getRawOne();
      const avgTurnover = rows?.avg_turnover ? Number(rows.avg_turnover) : 0;

      let days: number;
      if (avgTurnover <= 0) {
        days = FALLBACK_DAYS;
        logger.warn(`Liquidity metric: no turnover data for ${h.symbol}, fallback ${FALLBACK_DAYS} days`, { portfolioId });
      } else {
        days = Math.max(mv / avgTurnover, MIN_DAYS);
      }
      weightedDays += weight * days;
    }

    return parseFloat(weightedDays.toFixed(4));
  }

  /**
   * P1-4: 检查是否在冷却期内（同一 monitor + 同一 metric_type 有未 resolved 的告警且未过冷却期）
   */
  private static async isInCoolingPeriod(monitor: MonitorConfig, metricType: string): Promise<boolean> {
    const coolingMinutes = monitor.cooling_period_minutes || 5;
    const coolingDeadline = new Date(Date.now() - coolingMinutes * 60 * 1000);

    try {
      const recentAlert = await alertRepo().createQueryBuilder('a')
        .where('a.rule_id = :ruleId', { ruleId: monitor.config_id })
        .andWhere('a.alert_type = :metricType', { metricType })
        .andWhere('a.status = :status', { status: 'active' })
        .andWhere('a.triggered_at >= :coolingDeadline', { coolingDeadline: coolingDeadline.toISOString() })
        .orderBy('a.triggered_at', 'DESC')
        .getOne();

      return !!recentAlert;
    } catch (e: any) {
      logger.error(`Cooling period check failed: ${e.message}`);
      return false; // 出错时允许触发，避免阻塞
    }
  }

  /**
   * 解析监控指标列表：支持多指标配置（metrics JSON）和单指标兼容模式
   */
  private static resolveMetricsToCheck(monitor: MonitorConfig): Array<{ type: string; threshold: number; operator: string }> {
    const metrics = monitor.metrics;
    if (metrics && typeof metrics === 'object' && Object.keys(metrics).length > 0) {
      // 多指标模式：metrics 对象中每个 key 是一个指标配置
      return Object.entries(metrics).map(([key, config]: [string, any]) => ({
        type: key,
        threshold: Number(config.threshold ?? monitor.threshold),
        operator: config.operator || monitor.operator || '>',
      }));
    }
    // 单指标兼容模式
    return [{
      type: monitor.monitor_type,
      threshold: Number(monitor.threshold),
      operator: monitor.operator || '>',
    }];
  }

  private static async triggerAlert(
    monitor: MonitorConfig,
    metric: { type: string; threshold: number; operator: string },
    value: number,
    threshold: number
  ) {
    const triggeredAt = new Date();
    const { title, message } = this.buildAlertTitleAndMessage(monitor, metric, value, threshold);
    const alert = alertRepo().create({
      portfolio_id: monitor.portfolio_id,
      rule_id: monitor.config_id,
      user_id: monitor.user_id,
      alert_type: metric.type,
      severity: this.getSeverity(value, threshold),
      title,
      message,
      triggered_at: triggeredAt,
      status: 'active',
      trigger_details: {
        threshold,
        actual_value: value,
        variance: value - threshold,
        metric_type: metric.type,
        monitor_notification: monitor.notification || { enabled: true, channels: ['app'] },
      },
    });
    await alertRepo().save(alert);
    logger.info(`Alert triggered: ${alert.history_id} for monitor ${monitor.config_id} metric ${metric.type}`);

    // 风险事件触发后，将匹配的未通知影响标记为已通知
    if (metric.type === 'risk_event') {
      await this.markRiskEventsNotified(monitor);
    }

    // 发送多渠道通知（记录延迟）
    try {
      const results = await NotificationService.sendAlertNotification(alert);
      const firstSuccess = results.find(r => r.success && r.sentAt);
      if (firstSuccess?.sentAt) {
        const latency = firstSuccess.sentAt.getTime() - triggeredAt.getTime();
        alert.notification_latency_ms = latency;
        await alertRepo().save(alert);
        logger.info('Notification latency recorded', { alertId: alert.history_id, latencyMs: latency });
      }
    } catch (notifyErr: any) {
      logger.warn('Notification send failed', { alertId: alert.history_id, error: notifyErr.message });
    }

    // WebSocket 实时推送
    try {
      const ws = WebSocketService.getInstance();
      ws.pushAlert(monitor.portfolio_id, {
        alert_id: alert.history_id,
        monitor_id: monitor.config_id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        triggered_at: alert.triggered_at,
        portfolio_id: monitor.portfolio_id,
      });
    } catch (wsErr: any) {
      logger.warn('WebSocket push failed', { alertId: alert.history_id, error: wsErr.message });
    }
  }

  /**
   * 根据监控类型构建告警标题与内容
   */
  private static buildAlertTitleAndMessage(
    monitor: MonitorConfig,
    metric: { type: string; threshold: number; operator: string },
    value: number,
    threshold: number
  ): { title: string; message: string } {
    switch (metric.type) {
      case 'stop_loss': {
        return {
          title: `${monitor.config_name} — 止损触发预警`,
          message: `组合内存在持仓跌破止损参考价，最大偏离 ${(value * 100).toFixed(2)}%`,
        };
      }
      case 'risk_event': {
        return {
          title: `${monitor.config_name} — 风险事件提醒`,
          message: `监测到 ${Math.floor(value)} 条与您持仓相关的未读风险事件，请及时关注`,
        };
      }
      case 'volatility_spike': {
        return {
          title: `${monitor.config_name} — 市场波动率异常`,
          message: `当前市场波动率处于近1年历史 ${(value * 100).toFixed(2)}% 分位，且较前一日上涨超过 10%，请注意持仓风险`,
        };
      }
      default: {
        return {
          title: `${monitor.config_name} — ${metric.type} 触发预警`,
          message: `VaR ${(value * 100).toFixed(2)}% ${metric.operator} 阈值 ${(threshold * 100).toFixed(2)}%`,
        };
      }
    }
  }

  /**
   * 将风险事件匹配影响标记为已通知
   */
  private static async markRiskEventsNotified(monitor: MonitorConfig) {
    try {
      const where: any = { user_id: monitor.user_id, is_notified: false };
      if (monitor.portfolio_id) where.portfolio_id = monitor.portfolio_id;
      await impactRepo().update(where, { is_notified: true, notified_at: new Date() });
    } catch (e: any) {
      logger.error(`Failed to mark risk events notified for monitor ${monitor.config_id}: ${e.message}`);
    }
  }

  private static getSeverity(value: number, threshold: number): string {
    const ratio = value / threshold;
    if (ratio >= 2) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  /**
   * T-7: 查询预警延迟指标统计
   */
  static async getAlertLatencyMetrics(portfolioId?: string, hours = 24): Promise<{
    avg_latency_ms: number;
    max_latency_ms: number;
    min_latency_ms: number;
    alert_count: number;
    on_time_rate: number; // 延迟 < 60s 的占比
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const qb = alertRepo().createQueryBuilder('a')
      .where('a.triggered_at >= :since', { since })
      .andWhere('a.notification_latency_ms IS NOT NULL');
    
    if (portfolioId) {
      qb.andWhere('a.portfolio_id = :portfolioId', { portfolioId });
    }

    const alerts = await qb.getMany();
    const count = alerts.length;

    if (count === 0) {
      return { avg_latency_ms: 0, max_latency_ms: 0, min_latency_ms: 0, alert_count: 0, on_time_rate: 0 };
    }

    const latencies = alerts.map(a => a.notification_latency_ms || 0);
    const avg = latencies.reduce((s, v) => s + v, 0) / count;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);
    const onTime = latencies.filter(v => v < 60000).length;

    return {
      avg_latency_ms: Math.round(avg),
      max_latency_ms: max,
      min_latency_ms: min,
      alert_count: count,
      on_time_rate: parseFloat((onTime / count).toFixed(4)),
    };
  }
}
