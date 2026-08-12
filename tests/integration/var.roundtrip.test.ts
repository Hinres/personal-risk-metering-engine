/**
 * [PRME-INT-VAR] VaR 计算 round-trip 集成测试
 * 文件: var.roundtrip.test.ts
 * 测试范围: 真实数据库下「计算 VaR → 历史记录回查」数据一致性
 * 最后更新: 2026-08-06
 */

import request from 'supertest';
import app from '../../src/app';
import { AppDataSource, initializeDatabase, closeDatabase } from '../../src/config/database';
import { MarketData } from '../../src/models/MarketData';
import { stopJobs } from '../../src/jobs';
import { closeBrowser } from '../../src/services/report.service';
import { stopRateLimitStore } from '../../src/middleware/rateLimit.middleware';
import { memoryCache } from '../../src/utils/memoryCache';

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

describe('VaR Calculation Round-trip Integration Test', () => {
  let token: string;
  let portfolioId: string;
  let holdingId: string;

  const testUser = {
    username: 'roundtrip_var_user',
    email: 'roundtrip_var@example.com',
    phone: '13800444000',
    password: 'TestPass123!@#',
  };

  const symbol = '600519';

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await initializeDatabase();
    }

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);
    expect(registerRes.status).toBe(201);
    token = registerRes.body.data.token;
    expect(token).toBeDefined();

    const ackRes = await request(app)
      .post('/api/v1/users/risk-acknowledgment')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(ackRes.status).toBe(200);

    const portfolioRes = await request(app)
      .post('/api/v1/portfolios')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'VaR Test Portfolio', type: 'stock' });
    expect(portfolioRes.status).toBe(201);
    portfolioId = portfolioRes.body.data.portfolio_id;

    // 插入最新市场数据，使 addHolding 能获取到当前价格
    const marketRepo = AppDataSource.getRepository(MarketData);
    await marketRepo.save({
      symbol,
      name: 'Kweichow Moutai',
      trade_date: new Date(),
      close_price: 1500,
      open_price: 1490,
      high_price: 1510,
      low_price: 1480,
      volume: 10000,
    });

    const holdingRes = await request(app)
      .post(`/api/v1/holdings/portfolio/${portfolioId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol,
        name: 'Kweichow Moutai',
        security_type: 'stock',
        exchange: 'SSE',
        quantity: 100,
        cost_price: 1400,
        sector: 'Consumer',
        industry: 'Beverage',
      });
    expect(holdingRes.status).toBe(201);
    holdingId = holdingRes.body.data.holding_id;
  });

  afterAll(async () => {
    stopRateLimitStore();
    memoryCache.stop();
    await closeDatabase();
    stopJobs();
    await closeBrowser();
  });

  it('should calculate VaR and retrieve it from history', async () => {
    const calcRes = await request(app)
      .post('/api/v1/var/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        portfolio_id: portfolioId,
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'parametric',
      });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.success).toBe(true);
    const varId = calcRes.body.data.var_id;
    expect(varId).toBeDefined();

    const historyRes = await request(app)
      .get(`/api/v1/var/history?portfolio_id=${portfolioId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    const records = historyRes.body.data;
    expect(records.length).toBeGreaterThan(0);
    const found = records.find((r: any) => r.var_id === varId);
    expect(found).toBeDefined();
    expect(found.calculation_type).toBe('parametric');
    expect(Number(found.confidence_level)).toBe(0.95);
    expect(Number(found.time_horizon)).toBe(1);
  });
});
