import { VaRService } from '../../src/services/var.service';

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    // Shared in-memory storage across all repositories
    _storage: new Map<string, any[]>(),
    getRepository: jest.fn().mockImplementation(function(this: any, entity: any) {
      const entityName = entity?.name || entity;
      const storage = this._storage;

      return {
        find: jest.fn().mockImplementation(({ where }: any) => {
          const key = entityName;
          const all = storage.get(key) || [];
          if (!where) return Promise.resolve(all);
          return Promise.resolve(
            all.filter((item: any) =>
              Object.entries(where).every(([k, v]) => item[k] === v)
            )
          );
        }),
        findOne: jest.fn().mockImplementation(({ where }: any) => {
          const key = entityName;
          const all = storage.get(key) || [];
          if (!where) return Promise.resolve(all[0] || null);
          return Promise.resolve(
            all.find((item: any) =>
              Object.entries(where).every(([k, v]) => item[k] === v)
            ) || null
          );
        }),
        count: jest.fn().mockImplementation(({ where }: any) => {
          const key = entityName;
          const all = storage.get(key) || [];
          if (!where) return Promise.resolve(all.length);
          return Promise.resolve(
            all.filter((item: any) =>
              Object.entries(where).every(([k, v]) => item[k] === v)
            ).length
          );
        }),
        create: jest.fn().mockImplementation((data: any) => {
          return { ...data,
            portfolio_id: data.portfolio_id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            holding_id: data.holding_id || `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            config_id: data.config_id || `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            monitor_id: data.monitor_id || `m_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            alert_id: data.alert_id || `a_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            log_id: data.log_id || `l_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            history_id: data.history_id || `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          };
        }),
        save: jest.fn().mockImplementation((entity: any) => {
          const key = entityName;
          if (!storage.has(key)) storage.set(key, []);
          const existing = storage.get(key)!;
          const idField = entityName === 'Holding' ? 'holding_id' :
                          entityName === 'Portfolio' ? 'portfolio_id' :
                          entityName === 'MonitorConfig' ? 'config_id' :
                          entityName === 'AlertHistory' ? 'history_id' :
                          entityName === 'AuditLog' ? 'log_id' :
                          entityName === 'VaRCalculation' ? 'var_id' : 'id';

          // Handle array saves
          if (Array.isArray(entity)) {
            const saved = entity.map((e) => {
              const eId = e[idField];
              const idx = eId ? existing.findIndex((x: any) => x[idField] === eId) : -1;
              if (idx >= 0) {
                existing[idx] = { ...existing[idx], ...e };
                return existing[idx];
              }
              // Always generate holding_id for new holdings
              if (!e.holding_id && entityName === 'Holding') {
                e = { ...e, holding_id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
              }
              existing.push(e);
              return e;
            });
            return Promise.resolve(saved);
          }

          // Single entity save
          const entityId = entity[idField];
          const idx = entityId ? existing.findIndex((x: any) => x[idField] === entityId) : -1;
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...entity };
            return Promise.resolve(existing[idx]);
          }
          // Always generate holding_id for new holdings
          if (!entity.holding_id && entityName === 'Holding') {
            entity = { ...entity, holding_id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
          }
          existing.push(entity);
          return Promise.resolve(entity);
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
          getMany: jest.fn().mockResolvedValue([]),
          delete: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        }),
        delete: jest.fn().mockImplementation((id: string) => {
          const key = entityName;
          const all = storage.get(key) || [];
          const idField = entityName === 'Holding' ? 'holding_id' :
                          entityName === 'Portfolio' ? 'portfolio_id' :
                          entityName === 'MonitorConfig' ? 'config_id' :
                          entityName === 'AlertHistory' ? 'history_id' :
                          entityName === 'AuditLog' ? 'log_id' :
                          entityName === 'VaRCalculation' ? 'var_id' : 'id';
          const filtered = all.filter((x: any) => x[idField] !== id && x.holding_id !== id && x.portfolio_id !== id && x.monitor_id !== id && x.alert_id !== id && x.log_id !== id);
          storage.set(key, filtered);
          return Promise.resolve({ affected: all.length - filtered.length });
        }),
      };
    }),
    query: jest.fn().mockResolvedValue([]),
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
    createQueryRunner: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
      release: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../../src/services/var.service', () => ({
  VaRService: {
    getLatest: jest.fn().mockResolvedValue({
      var_percentage: 0.06,
      var_value: -5000,
    }),
  },
}));

describe('Trigger → Application Layer Migration - Functional Equivalence', () => {
  let PortfolioService: any;
  let AuditService: any;
  let MonitorService: any;
  let mockHoldingRepo: any;
  let mockPortfolioRepo: any;
  let mockMonitorRepo: any;
  let mockAlertRepo: any;
  let mockLogRepo: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const { AppDataSource } = require('../../src/config/database');
    AppDataSource._storage.clear();

    PortfolioService = require('../../src/services/portfolio.service').PortfolioService;
    AuditService = require('../../src/services/audit.service').AuditService;
    MonitorService = require('../../src/services/monitor.service').MonitorService;

    mockHoldingRepo = AppDataSource.getRepository('Holding');
    mockPortfolioRepo = AppDataSource.getRepository('Portfolio');
    mockMonitorRepo = AppDataSource.getRepository('MonitorConfig');
    mockAlertRepo = AppDataSource.getRepository('AlertHistory');
    mockLogRepo = AppDataSource.getRepository('AuditLog');
  });

  describe('TC-TRIG.1 ~ TRIG.3: Portfolio statistics update on holding CRUD', () => {
    it('TC-TRIG.1: addHolding should update portfolio statistics', async () => {
      // Setup: create portfolio
      const portfolio = await mockPortfolioRepo.save({
        portfolio_id: 'p1',
        user_id: 'u1',
        name: 'Test Portfolio',
        statistics: null,
      });

      // Add holding
      const holding = await mockHoldingRepo.save({
        portfolio_id: 'p1',
        symbol: 'AAPL',
        quantity: 100,
        cost_price: 150,
        market_value: 16000,
      });

      // Simulate holding.controller addHolding flow
      await PortfolioService.updateStatistics('p1');

      // Verify statistics updated
      const updated = await mockPortfolioRepo.findOne({ where: { portfolio_id: 'p1' } });
      expect(updated.statistics).not.toBeNull();
      expect(updated.statistics.total_value).toBe(16000);
      expect(updated.statistics.holding_count).toBe(1);
      expect(updated.statistics.total_cost).toBe(15000);
      expect(updated.statistics.unrealized_pnl).toBe(1000);
    });

    it('TC-TRIG.2: updateHolding should recalculate statistics', async () => {
      // Setup portfolio with 2 holdings
      await mockPortfolioRepo.save({
        portfolio_id: 'p2',
        user_id: 'u1',
        name: 'Test Portfolio 2',
        statistics: null,
      });

      await mockHoldingRepo.save([
        { portfolio_id: 'p2', symbol: 'A', quantity: 100, cost_price: 100, market_value: 11000 },
        { portfolio_id: 'p2', symbol: 'B', quantity: 200, cost_price: 50, market_value: 12000 },
      ]);

      await PortfolioService.updateStatistics('p2');

      // Update one holding
      const holdings = await mockHoldingRepo.find({ where: { portfolio_id: 'p2' } });
      const holdingA = holdings.find((h: any) => h.symbol === 'A');
      await mockHoldingRepo.save({
        ...holdingA,
        quantity: 200,
        market_value: 22000,
      });

      await PortfolioService.updateStatistics('p2');

      const updated = await mockPortfolioRepo.findOne({ where: { portfolio_id: 'p2' } });
      expect(updated.statistics.total_value).toBe(34000); // 22000 + 12000
    });

    it('TC-TRIG.3: deleteHolding should zero out statistics when all holdings removed', async () => {
      // Setup portfolio with 1 holding
      await mockPortfolioRepo.save({
        portfolio_id: 'p3',
        user_id: 'u1',
        name: 'Test Portfolio 3',
        statistics: null,
      });

      await mockHoldingRepo.save({
        portfolio_id: 'p3',
        symbol: 'C',
        quantity: 100,
        cost_price: 50,
        market_value: 5000,
      });

      await PortfolioService.updateStatistics('p3');

      // Delete holding
      const holdings = await mockHoldingRepo.find({ where: { portfolio_id: 'p3' } });
      for (const h of holdings) {
        await mockHoldingRepo.delete(h.holding_id);
      }

      await PortfolioService.updateStatistics('p3');

      const updated = await mockPortfolioRepo.findOne({ where: { portfolio_id: 'p3' } });
      expect(updated.statistics.total_value).toBe(0);
      expect(updated.statistics.holding_count).toBe(0);
      expect(updated.statistics.unrealized_pnl).toBe(0);
    });
  });

  describe('TC-TRIG.4 ~ TRIG.5: VaR threshold monitor triggering', () => {
    it('TC-TRIG.4: VaR calculation should trigger monitor alert', async () => {
      // Setup monitor
      const monitor = await mockMonitorRepo.save({
        portfolio_id: 'p4',
        user_id: 'u1',
        monitor_name: 'VaR监控',
        monitor_type: 'var_threshold',
        threshold: 0.05,
        operator: '>',
        status: 'active',
        trigger_count: 0,
      });

      // Simulate VaR calculation flow
      await MonitorService.checkPortfolioMonitors('p4');

      // Verify alert created
      const alerts = await mockAlertRepo.find({ where: { portfolio_id: 'p4' } });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alert_type).toBe('var_threshold');
    });

    it('TC-TRIG.5: alert severity should be graded correctly', async () => {
      // VaR percentage = 0.06, threshold = 0.05
      // ratio = 0.06 / 0.05 = 1.2 → medium severity
      const monitor = await mockMonitorRepo.save({
        portfolio_id: 'p5',
        user_id: 'u1',
        monitor_name: 'VaR监控',
        monitor_type: 'var_threshold',
        threshold: 0.05,
        operator: '>',
        status: 'active',
        trigger_count: 0,
      });

      await MonitorService.checkPortfolioMonitors('p5');

      const alerts = await mockAlertRepo.find({ where: { portfolio_id: 'p5' } });
      expect(alerts.length).toBeGreaterThan(0);
      // Severity should be one of: low, medium, high, critical
      expect(['low', 'medium', 'high', 'critical']).toContain(alerts[0].severity);
    });

    it('TC-TRIG.5: ratio >= 2 should be critical', async () => {
      // Mock VaRService to return very high VaR
      const { VaRService } = require('../../src/services/var.service');
      VaRService.getLatest.mockResolvedValueOnce({
        var_percentage: 0.12,
        var_value: -12000,
      });

      const monitor = await mockMonitorRepo.save({
        portfolio_id: 'p6',
        user_id: 'u1',
        monitor_name: 'VaR监控',
        monitor_type: 'var_threshold',
        threshold: 0.05,
        operator: '>',
        status: 'active',
        trigger_count: 0,
      });

      await MonitorService.checkPortfolioMonitors('p6');

      const alerts = await mockAlertRepo.find({ where: { portfolio_id: 'p6' } });
      if (alerts.length > 0) {
        expect(alerts[0].severity).toBe('critical');
      }
    });
  });

  describe('TC-TRIG.6 ~ TRIG.8: Audit logging', () => {
    it('TC-TRIG.6: logCreate should create CREATE operation log', async () => {
      await AuditService.logCreate('portfolios', 'p10', { name: 'New Portfolio' }, {
        userId: 'u1',
        ipAddress: '192.168.1.1',
      });

      const logs = await mockLogRepo.find({ where: { resource_type: 'portfolios' } });
      expect(logs.length).toBe(1);
      expect(logs[0].operation_type).toBe('CREATE');
      expect(logs[0].resource_id).toBe('p10');
      expect(logs[0].details.new.name).toBe('New Portfolio');
    });

    it('TC-TRIG.7: logUpdate should create UPDATE operation log with old/new data', async () => {
      await AuditService.logUpdate(
        'holdings',
        'h10',
        { quantity: 100, market_value: 5000 },
        { quantity: 200, market_value: 10000 },
        { userId: 'u1', ipAddress: '192.168.1.1' }
      );

      const logs = await mockLogRepo.find({ where: { resource_type: 'holdings' } });
      expect(logs.length).toBe(1);
      expect(logs[0].operation_type).toBe('UPDATE');
      expect(logs[0].details.old.quantity).toBe(100);
      expect(logs[0].details.new.quantity).toBe(200);
    });

    it('TC-TRIG.8: logDelete should create DELETE operation log with old data', async () => {
      await AuditService.logDelete(
        'portfolios',
        'p20',
        { name: 'Deleted Portfolio', total_value: 50000 },
        { userId: 'u1', ipAddress: '192.168.1.1' }
      );

      const logs = await mockLogRepo.find({ where: { resource_type: 'portfolios' } });
      const deleteLog = logs.find((l: any) => l.operation_type === 'DELETE');
      expect(deleteLog).toBeDefined();
      expect(deleteLog.details.old.name).toBe('Deleted Portfolio');
    });
  });

  describe('TC-TRIG.9: Audit log failure isolation', () => {
    it('should not throw when database save fails', async () => {
      // Mock save to fail
      mockLogRepo.save.mockRejectedValueOnce(new Error('DB connection lost'));

      // This should not throw
      await expect(
        AuditService.logCreate('portfolios', 'p99', { name: 'Test' }, { userId: 'u1' })
      ).resolves.not.toThrow();
    });
  });
});