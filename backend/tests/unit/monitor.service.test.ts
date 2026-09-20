/**
 * [PRME-PA-001] monitor.service 单元测试
 * 测试范围: getMonitors, create, update, delete, checkAllMonitors, checkPortfolioMonitors,
 *           checkMonitor, getMetricValue, isInCoolingPeriod, resolveMetricsToCheck,
 *           triggerAlert, getSeverity, getAlertLatencyMetrics
 * 最后更新: 2026-07-08
 */

jest.mock('../../src/config/database', () => {
  const sharedQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getRawOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return {
    AppDataSource: {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(sharedQb),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      }),
    },
  };
});

jest.mock('../../src/services/var.service', () => ({
  VaRService: {
    getLatest: jest.fn().mockResolvedValue({
      var_percentage: 0.05,
      expected_shortfall: 0.06,
      volatility: 0.02,
      risk_factors: [{ factor_name: 'max_drawdown', value: 0.1 }],
    }),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  NotificationService: {
    sendAlertNotification: jest.fn().mockResolvedValue([{ success: true, sentAt: new Date() }]),
  },
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      pushAlert: jest.fn(),
    }),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AppDataSource } from '../../src/config/database';
import { MonitorService } from '../../src/services/monitor.service';
import { VaRService } from '../../src/services/var.service';
import { NotificationService } from '../../src/services/notification.service';
import logger from '../../src/utils/logger';

describe('MonitorService', () => {
  let repo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = (AppDataSource.getRepository as jest.Mock)();
  });

  describe('getMonitors', () => {
    it('should return monitors without portfolioId', async () => {
      repo.find.mockResolvedValue([{ config_id: 'm1', config_name: 'Test' }]);
      const result = await MonitorService.getMonitors('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].monitor_id).toBe('m1');
    });

    it('should return monitors with portfolioId', async () => {
      repo.find.mockResolvedValue([{ config_id: 'm1', config_name: 'Test' }]);
      const result = await MonitorService.getMonitors('user-1', 'p1');
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ portfolio_id: 'p1' }),
      }));
    });
  });

  describe('getById / getMonitor', () => {
    it('should return monitor by id', async () => {
      repo.findOne.mockResolvedValue({ config_id: 'm1', config_name: 'Test', user_id: 'u1' });
      const result = await MonitorService.getById('m1', 'u1');
      expect(result?.monitor_id).toBe('m1');
      expect(result?.monitor_name).toBe('Test');
    });

    it('should return null when monitor not found', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await MonitorService.getMonitor('m1', 'u1');
      expect(result).toBeNull();
    });

    it('should filter by user and status', async () => {
      repo.findOne.mockResolvedValue(null);
      await MonitorService.getById('m1', 'u1');
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ config_id: 'm1', user_id: 'u1', status: 'active' }),
      }));
    });
  });

  describe('create', () => {
    it('should create monitor with default notification', async () => {
      repo.create.mockReturnValue({ config_id: 'm1' });
      repo.save.mockResolvedValue({ config_id: 'm1', config_name: 'Test' });
      const result = await MonitorService.create('user-1', {
        portfolio_id: 'p1',
        monitor_name: 'Test',
        monitor_type: 'var',
        threshold: 0.05,
      });
      expect(result.monitor_id).toBe('m1');
    });

    it('should create monitor with notification_channels', async () => {
      repo.create.mockReturnValue({ config_id: 'm1' });
      repo.save.mockResolvedValue({ config_id: 'm1' });
      await MonitorService.create('user-1', {
        portfolio_id: 'p1',
        monitor_name: 'Test',
        monitor_type: 'var',
        threshold: 0.05,
        notification_channels: ['email', 'sms'],
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        notification: expect.objectContaining({ channels: ['email', 'sms'] }),
      }));
    });
  });

  describe('update', () => {
    it('should throw when monitor is not active', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(MonitorService.update('m1', 'user-1', { monitor_name: 'New' })).rejects.toThrow('Monitor not found');
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ config_id: 'm1', user_id: 'user-1', status: 'active' }),
      }));
    });

    it('should throw when monitor not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(MonitorService.update('m1', 'user-1', {})).rejects.toThrow('Monitor not found');
    });

    it('should map monitor_name to config_name', async () => {
      repo.findOne.mockResolvedValue({ config_id: 'm1', config_name: 'Old' });
      repo.save.mockResolvedValue({ config_id: 'm1', config_name: 'New' });
      const result = await MonitorService.update('m1', 'user-1', { monitor_name: 'New' });
      expect(result.monitor_name).toBe('New');
    });

    it('should map frontend fields to backend entity fields', async () => {
      repo.findOne.mockResolvedValue({
        config_id: 'm1',
        config_name: 'Old',
        threshold: 0.05,
        operator: '>',
        notification: { enabled: true, channels: ['app'] },
        rules: {},
        metrics: {},
      });
      let saved: any;
      repo.save.mockImplementation((m: any) => {
        saved = m;
        return m;
      });

      await MonitorService.update('m1', 'user-1', {
        monitor_name: 'Updated',
        threshold_value: 0.1,
        comparison: '<',
        severity: 'high',
        notification_methods: ['wechat', 'email'],
      });

      expect(saved.config_name).toBe('Updated');
      expect(saved.threshold).toBe(0.1);
      expect(saved.operator).toBe('<');
      expect(saved.rules.severity).toBe('high');
      expect(saved.notification.channels).toEqual(['wechat', 'email']);
      // 映射后应删除前端字段，避免被 Object.assign 污染
      expect(saved.monitor_name).toBeUndefined();
      expect(saved.threshold_value).toBeUndefined();
      expect(saved.comparison).toBeUndefined();
      expect(saved.severity).toBeUndefined();
      expect(saved.notification_methods).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete active monitor', async () => {
      repo.findOne.mockResolvedValue({ config_id: 'm1', status: 'active' });
      const result = await MonitorService.delete('m1', 'user-1');
      expect(result).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when deleting non-active monitor', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(MonitorService.delete('m1', 'user-1')).rejects.toThrow('Monitor not found');
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ config_id: 'm1', user_id: 'user-1', status: 'active' }),
      }));
    });

    it('should throw when monitor not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(MonitorService.delete('m1', 'user-1')).rejects.toThrow('Monitor not found');
    });
  });

  describe('checkAllMonitors', () => {
    it('should skip monitors in cooling period', async () => {
      repo.find.mockResolvedValue([{
        config_id: 'm1', portfolio_id: 'p1', status: 'active',
        check_interval_seconds: 300, last_triggered: new Date(),
        monitor_type: 'var', threshold: 0.05, operator: '>', metrics: {},
      }]);
      await MonitorService.checkAllMonitors();
      expect(repo.find).toHaveBeenCalled();
    });

    it('should check and trigger alert', async () => {
      repo.find.mockResolvedValue([{
        config_id: 'm1', portfolio_id: 'p1', status: 'active',
        check_interval_seconds: 30, last_triggered: new Date(Date.now() - 60000),
        monitor_type: 'var', threshold: 0.01, operator: '>', metrics: {},
        cooling_period_minutes: 5, notification: { enabled: true, channels: ['app'] },
        trigger_count: 0,
      }]);
      const qb = repo.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      await MonitorService.checkAllMonitors();
      expect(NotificationService.sendAlertNotification).toHaveBeenCalled();
    });
  });

  describe('checkPortfolioMonitors', () => {
    it('should check portfolio monitors', async () => {
      repo.find.mockResolvedValue([{
        config_id: 'm1', portfolio_id: 'p1', status: 'active',
        check_interval_seconds: 30, last_triggered: new Date(Date.now() - 60000),
        monitor_type: 'var', threshold: 0.01, operator: '>', metrics: {},
        cooling_period_minutes: 5, notification: { enabled: true, channels: ['app'] },
        trigger_count: 0,
      }]);
      const qb = repo.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      await MonitorService.checkPortfolioMonitors('p1');
      expect(NotificationService.sendAlertNotification).toHaveBeenCalled();
    });
  });

  describe('getMetricValue', () => {
    it('should return var value', async () => {
      const result = await (MonitorService as any).getMetricValue('p1', 'var');
      expect(result).toBe(0.05);
    });

    it('should return cvar value', async () => {
      repo.findOne.mockResolvedValue({ expected_shortfall: 0.06 });
      const result = await (MonitorService as any).getMetricValue('p1', 'cvar');
      expect(result).toBe(0.06);
    });

    it('should return volatility', async () => {
      repo.findOne.mockResolvedValue({ volatility: 0.02 });
      const result = await (MonitorService as any).getMetricValue('p1', 'volatility');
      expect(result).toBe(0.02);
    });

    it('should return max_drawdown from cache', async () => {
      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
        if (entity?.name === 'PortfolioSummaryCache') {
          return { findOne: jest.fn().mockResolvedValue({ max_drawdown: 0.15 }) };
        }
        return repo;
      });
      const result = await (MonitorService as any).getMetricValue('p1', 'max_drawdown');
      expect(result).toBe(0.15);
    });

    it('should return max_drawdown from risk_factors', async () => {
      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
        if (entity?.name === 'PortfolioSummaryCache') {
          return { findOne: jest.fn().mockResolvedValue(null) };
        }
        if (entity?.name === 'VaRCalculation') {
          return { findOne: jest.fn().mockResolvedValue({ risk_factors: [{ factor_name: 'max_drawdown', value: 0.1 }] }) };
        }
        return repo;
      });
      const result = await (MonitorService as any).getMetricValue('p1', 'max_drawdown');
      expect(result).toBe(0.1);
    });

    // DEF-V131-003（2026-09-19）：未知指标不再静默回退 VaR，改为 warn + null（防错误配置无感知）
    it('should return null for unknown metric (no silent VaR fallback)', async () => {
      const result = await (MonitorService as any).getMetricValue('p1', 'unknown');
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('resolveMetricsToCheck', () => {
    it('should use multi-metric mode', async () => {
      const monitor = { metrics: { var: { threshold: 0.05 } }, monitor_type: 'var', threshold: 0.05, operator: '>' };
      const result = (MonitorService as any).resolveMetricsToCheck(monitor);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('var');
    });

    it('should use single-metric fallback', async () => {
      const monitor = { metrics: {}, monitor_type: 'var', threshold: 0.05, operator: '>' };
      const result = (MonitorService as any).resolveMetricsToCheck(monitor);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('var');
    });
  });

  // 观察项#1（SIT 20260920）：告警文案按 metric_type 分类型，liquidity/concentration 不按百分比放大
  describe('buildAlertTitleAndMessage', () => {
    const monitor: any = { config_name: '测试监控' };

    it('should format liquidity in days without %', () => {
      const r = (MonitorService as any).buildAlertTitleAndMessage(
        monitor, { type: 'liquidity', threshold: 5, operator: '>' }, 10, 5);
      expect(r.message).toBe('流动性（预计变现天数） 10 天 > 阈值 5 天');
      expect(r.title).toBe('测试监控 — 流动性（预计变现天数） 触发预警');
    });

    it('should format concentration as HHI index without %', () => {
      const r = (MonitorService as any).buildAlertTitleAndMessage(
        monitor, { type: 'concentration', threshold: 0.3, operator: '>' }, 0.5297, 0.3);
      expect(r.message).toBe('持仓集中度（HHI） 0.5297 > 阈值 0.3000');
    });

    it('should keep var_percentage in percent format', () => {
      const r = (MonitorService as any).buildAlertTitleAndMessage(
        monitor, { type: 'var_percentage', threshold: 0.3, operator: '>' }, 0.5297, 0.3);
      expect(r.message).toBe('VaR 52.97% > 阈值 30.00%');
    });

    it('should format drawdown alias mdd in percent', () => {
      const r = (MonitorService as any).buildAlertTitleAndMessage(
        monitor, { type: 'mdd', threshold: 0.2, operator: '>' }, 0.35, 0.2);
      expect(r.message).toBe('最大回撤 35.00% > 阈值 20.00%');
    });
  });

  describe('getSeverity', () => {
    it('should return critical for ratio >= 2', () => {
      expect((MonitorService as any).getSeverity(0.2, 0.1)).toBe('critical');
    });

    it('should return high for ratio >= 1.5', () => {
      expect((MonitorService as any).getSeverity(3, 2)).toBe('high');
    });

    it('should return medium for ratio >= 1.2', () => {
      expect((MonitorService as any).getSeverity(0.12, 0.1)).toBe('medium');
    });

    it('should return low for ratio < 1.2', () => {
      expect((MonitorService as any).getSeverity(0.11, 0.1)).toBe('low');
    });
  });

  describe('getAlertLatencyMetrics', () => {
    it('should return zero when no alerts', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      const result = await MonitorService.getAlertLatencyMetrics();
      expect(result.alert_count).toBe(0);
    });

    it('should calculate latency metrics', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([
        { notification_latency_ms: 1000 },
        { notification_latency_ms: 2000 },
      ]);
      const result = await MonitorService.getAlertLatencyMetrics();
      expect(result.alert_count).toBe(2);
      expect(result.avg_latency_ms).toBe(1500);
    });
  });

  // DEF-V131-003 / V2-02（2026-09-19）：支持矩阵校验 + liquidity/concentration 指标
  describe('监控类型支持矩阵（DEF-V131-003 / V2-02）', () => {
    it('创建不支持的监控类型应抛 400 错（不产生监控任务）', async () => {
      await expect(
        MonitorService.create('u1', { portfolio_id: 'p1', monitor_type: 'sharpe_ratio', config_name: 'X' })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        MonitorService.create('u1', { portfolio_id: 'p1', monitor_type: 'sharpe_ratio', config_name: 'X' })
      ).rejects.toThrow('UNSUPPORTED_METRIC_TYPE');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('创建 liquidity / concentration / hhi 应放行（V2-02）', async () => {
      repo.create.mockReturnValue({ config_id: 'm1' });
      repo.save.mockResolvedValue({ config_id: 'm1' });
      for (const t of ['liquidity', 'concentration', 'hhi']) {
        await expect(
          MonitorService.create('u1', { portfolio_id: 'p1', monitor_type: t, config_name: 'X' })
        ).resolves.toBeTruthy();
      }
    });

    it('更新为不支持的类型应抛 400', async () => {
      repo.findOne.mockResolvedValue({ config_id: 'm1', user_id: 'u1', status: 'active' });
      await expect(
        MonitorService.update('m1', 'u1', { monitor_type: 'foo_bar' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('更新不修改 monitor_type 时不触发校验（回归）', async () => {
      repo.findOne.mockResolvedValue({ config_id: 'm1', user_id: 'u1', status: 'active', notification: {} });
      repo.save.mockResolvedValue({});
      await expect(MonitorService.update('m1', 'u1', { config_name: 'Y' })).resolves.toBeTruthy();
    });
  });

  describe('V2-02 liquidity / concentration 指标', () => {
    const getMetricValue = (MonitorService as any).getMetricValue.bind(MonitorService);
    const getLiquidity = (MonitorService as any).getPortfolioLiquidityDays.bind(MonitorService);

    it('liquidity：正常计算（市值权重 × 变现天数加权）', async () => {
      repo.find.mockResolvedValue([
        { symbol: '600519', market_value: 800000 },
        { symbol: '000001', market_value: 200000 },
      ]);
      const qb = repo.createQueryBuilder();
      // 600519 日均成交 20 万 → 4 天；000001 日均成交 10 万 → 2 天
      qb.getRawOne
        .mockResolvedValueOnce({ avg_turnover: 200000 })
        .mockResolvedValueOnce({ avg_turnover: 100000 });
      const v = await getLiquidity('p1');
      // 0.8×4 + 0.2×2 = 3.6
      expect(v).toBe(3.6);
    });

    it('liquidity：缺行情/turnover 为 0 时 fallback 10 天并 warn', async () => {
      repo.find.mockResolvedValue([{ symbol: '999999', market_value: 100000 }]);
      repo.createQueryBuilder().getRawOne.mockResolvedValue({ avg_turnover: null });
      const v = await getLiquidity('p1');
      expect(v).toBe(10);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('liquidity：无持仓返回 null', async () => {
      repo.find.mockResolvedValue([]);
      expect(await getLiquidity('p1')).toBeNull();
    });

    it('liquidity：总市值为 0 返回 null', async () => {
      repo.find.mockResolvedValue([{ symbol: 'A', market_value: 0 }]);
      expect(await getLiquidity('p1')).toBeNull();
    });

    it('concentration：HHI 与 structure 端点同口径（真实 calculateHHI 对账）', async () => {
      const { PortfolioService } = require('../../src/services/portfolio.service');
      repo.find.mockResolvedValue([
        { symbol: 'A', market_value: 600000 },
        { symbol: 'B', market_value: 400000 },
      ]);
      const expected = PortfolioService.calculateHHI([
        { market_value: 600000 }, { market_value: 400000 },
      ] as any);
      expect(await getMetricValue('p1', 'concentration')).toBe(expected);
      expect(await getMetricValue('p1', 'hhi')).toBe(expected);
    });

    it('concentration：空组合返回 null', async () => {
      repo.find.mockResolvedValue([]);
      expect(await getMetricValue('p1', 'concentration')).toBeNull();
    });

    it('default 分支不再静默回退 VaR（未知指标返回 null，不调 VaRService）', async () => {
      expect(await getMetricValue('p1', 'not_a_metric')).toBeNull();
      expect(VaRService.getLatest).not.toHaveBeenCalled();
    });
  });
});
