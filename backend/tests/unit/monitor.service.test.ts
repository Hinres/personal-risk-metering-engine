/**
 * [PRME-PA-001] monitor.service 单元测试
 * 测试范围: getMonitors, create, update, delete, checkAllMonitors, checkPortfolioMonitors,
 *           checkMonitor, getMetricValue, isInCoolingPeriod, resolveMetricsToCheck,
 *           triggerAlert, getSeverity, getAlertLatencyMetrics
 * 最后更新: 2026-07-08
 */

jest.mock('../../src/config/database', () => {
  const sharedQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
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

    it('should fallback to var for unknown metric', async () => {
      const result = await (MonitorService as any).getMetricValue('p1', 'unknown');
      expect(result).toBe(0.05);
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
});
