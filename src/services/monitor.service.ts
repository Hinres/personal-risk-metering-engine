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
import { VaRService } from './var.service';
import { NotificationService } from './notification.service';
import WebSocketService from './websocket.service';
import logger from '../utils/logger';

const monitorRepo = () => AppDataSource.getRepository(MonitorConfig);
const alertRepo = () => AppDataSource.getRepository(AlertHistory);
const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const cacheRepo = () => AppDataSource.getRepository(PortfolioSummaryCache);

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

    // 处理前端 severity 字段映射：权威来源为 rules.severity（REQ-DEC-20260807-001）
    let rules = data.rules || {};
    if (data.severity !== undefined) {
      rules = { ...rules, severity: data.severity };
    }

    const monitor = monitorRepo().create({
      user_id: userId,
      portfolio_id: data.portfolio_id,
      config_name: name,
      monitor_type: data.monitor_type,
      threshold: data.threshold,
      operator: data.operator || '>',
      notification: notification,
      rules,
      // M-08: 支持多指标配置和自定义检查频率
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
      data.rules = { ...monitor.rules, severity: data.severity };
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
        default: {
          // 未知指标类型：回退到 VaR（向后兼容，兼容测试 mock）
          logger.warn(`Unknown metric type "${metricType}", falling back to VaR`);
          const latest = await VaRService.getLatest(portfolioId);
          return latest?.var_percentage !== null && latest?.var_percentage !== undefined
            ? Number(latest.var_percentage)
            : null;
        }
      }
    } catch (e: any) {
      logger.error(`Failed to get metric value for ${metricType}: ${e.message}`);
      return null;
    }
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
    const alert = alertRepo().create({
      portfolio_id: monitor.portfolio_id,
      rule_id: monitor.config_id,
      user_id: monitor.user_id,
      alert_type: metric.type,
      severity: this.getSeverity(value, threshold),
      title: `${monitor.config_name} — ${metric.type} 触发预警`,
      message: `VaR ${(value * 100).toFixed(2)}% ${metric.operator} 阈值 ${(threshold * 100).toFixed(2)}%`,
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
