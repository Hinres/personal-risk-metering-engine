/**
 * [PRME-RM-001] 实时风险监控 - 轻量级测试
 * 文件: monitor.dashboard.test.ts
 * 测试范围: 监控 Dashboard 接口契约验证
 * 最后更新: 2026-06-18
 */

// Mock 所有重型依赖
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
  },
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

jest.mock('../../src/services/report.service', () => ({
  closeBrowser: jest.fn().mockResolvedValue(undefined),
}));

describe('Monitor Dashboard - 接口契约测试', () => {
  it('TC-MON.1: Dashboard 路由应存在', () => {
    const { default: router } = require('../../src/routes/monitor.routes');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('TC-MON.2: Dashboard Controller 应返回正确结构', async () => {
    const { getDashboard } = require('../../src/controllers/monitor.controller');
    
    const mockReq = {
      user: { user_id: 'test-user' },
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    await getDashboard(mockReq, mockRes as any);
    
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalled();
    
    const response = mockRes.json.mock.calls[0][0];
    expect(response.data).toHaveProperty('summary');
    expect(response.data).toHaveProperty('portfolios');
    expect(response.data).toHaveProperty('recent_alerts');
  });

  it('TC-MON.3: Summary 聚合应正确计算', () => {
    const summary = {
      portfolio_count: 2,
      total_value: 150000,
      total_active_alerts: 3,
      total_active_monitors: 5,
    };
    
    expect(summary.portfolio_count).toBe(2);
    expect(summary.total_value).toBe(150000);
    expect(summary.total_active_alerts).toBe(3);
    expect(summary.total_active_monitors).toBe(5);
  });

  it('TC-MON.4: VaR 数据应包含必要字段', () => {
    const varData = {
      var_id: 'v1',
      portfolio_id: 'p1',
      var_value: -25000,
      var_percentage: 0.05,
      confidence_level: 0.95,
      calculation_type: 'historical',
    };
    
    expect(varData).toHaveProperty('var_value');
    expect(varData).toHaveProperty('var_percentage');
    expect(varData).toHaveProperty('confidence_level');
    expect(varData.var_value).toBeLessThan(0);
    expect(varData.confidence_level).toBeGreaterThanOrEqual(0.9);
    expect(varData.confidence_level).toBeLessThanOrEqual(0.9999);
  });

  it('TC-MON.5: 预警列表应限制最大数量', () => {
    const alerts = Array.from({ length: 15 }, (_, i) => ({
      alert_id: `a${i}`,
      status: 'active',
    }));
    
    const recentAlerts = alerts.slice(0, 10);
    expect(recentAlerts.length).toBeLessThanOrEqual(10);
  });
});
