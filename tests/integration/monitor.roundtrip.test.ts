/**
 * [PRME-INT-MON] 监控规则 round-trip 集成测试
 * 文件: monitor.roundtrip.test.ts
 * 测试范围: 真实数据库下「创建 → 详情 → 修改 → 详情」字段一致性
 * 覆盖字段: monitor_name / threshold_value / comparison / severity / notification_methods
 * 最后更新: 2026-08-06
 */

import request from 'supertest';
import app from '../../src/app';
import { AppDataSource, initializeDatabase, closeDatabase } from '../../src/config/database';
import { stopJobs } from '../../src/jobs';
import { closeBrowser } from '../../src/services/report.service';
import { stopRateLimitStore } from '../../src/middleware/rateLimit.middleware';
import { memoryCache } from '../../src/utils/memoryCache';

// Puppeteer 在 Jest CommonJS 环境下会触发 ES Module 加载问题，统一 mock
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
  }),
  __esModule: true,
}));

describe('Monitor Round-trip Integration Test', () => {
  let token: string;
  let portfolioId: string;
  let monitorId: string;

  const testUser = {
    username: 'roundtrip_monitor_user',
    email: 'roundtrip_monitor@example.com',
    phone: '13800138111',
    password: 'TestPass123!@#',
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await initializeDatabase();
    }

    // 1. 注册并直接获取 token
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);
    expect(registerRes.status).toBe(201);
    token = registerRes.body.data.token;
    expect(token).toBeDefined();

    // 2. 确认首次风险提示
    const ackRes = await request(app)
      .post('/api/v1/users/risk-acknowledgment')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(ackRes.status).toBe(200);

    // 3. 创建测试组合
    const portfolioRes = await request(app)
      .post('/api/v1/portfolios')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roundtrip Monitor Portfolio', type: 'stock' });
    expect(portfolioRes.status).toBe(201);
    portfolioId = portfolioRes.body.data.portfolio_id;
    expect(portfolioId).toBeDefined();
  });

  afterAll(async () => {
    stopRateLimitStore();
    memoryCache.stop();
    await closeDatabase();
    stopJobs();
    await closeBrowser();
  });

  it('should persist and round-trip monitor frontend mapping fields', async () => {
    // Step 1: 创建监控规则，使用前端字段名
    const createRes = await request(app)
      .post('/api/v1/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        portfolio_id: portfolioId,
        monitor_name: 'Portfolio VaR Threshold',
        monitor_type: 'var_threshold',
        threshold: 100000,
        operator: '>',
        severity: 'high',
        notification_methods: ['app', 'email'],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    monitorId = createRes.body.data.monitor_id;
    expect(monitorId).toBeDefined();

    // Step 2: 详情回显，验证前端字段名已正确映射并返回
    const getRes = await request(app)
      .get(`/api/v1/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.monitor_id).toBe(monitorId);
    expect(getRes.body.data.monitor_name).toBe('Portfolio VaR Threshold');
    expect(getRes.body.data.threshold_value).toBe(100000);
    expect(getRes.body.data.comparison).toBe('>');
    expect(getRes.body.data.severity).toBe('high');
    expect(getRes.body.data.notification_methods).toEqual(['app', 'email']);

    // Step 3: 修改全部前端字段
    const updateRes = await request(app)
      .put(`/api/v1/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        monitor_name: 'Updated VaR Threshold',
        threshold_value: 200000,
        comparison: '<=',
        severity: 'high',
        notification_methods: ['wechat'],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // Step 4: 再次详情回显，验证修改已持久化
    const getRes2 = await request(app)
      .get(`/api/v1/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes2.status).toBe(200);
    expect(getRes2.body.success).toBe(true);
    expect(getRes2.body.data.monitor_name).toBe('Updated VaR Threshold');
    expect(getRes2.body.data.threshold_value).toBe(200000);
    expect(getRes2.body.data.comparison).toBe('<=');
    expect(getRes2.body.data.severity).toBe('high');
    expect(getRes2.body.data.notification_methods).toEqual(['wechat']);
  });
});
