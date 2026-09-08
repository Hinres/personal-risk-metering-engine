/**
 * [PRME-v1.3-PA-003] 优化筛选主路径 / 降级路径集成测试
 * 测试范围: GET /portfolios/{id}/optimize 四收益目标（return_*）
 *           ① 预置 stock_daily_basic / financial_data / market_data fixture → 主路径 screening.applied=true
 *           ② 无基本面数据 → 降级路径 screening.applied=false + data_warning
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §8/§10
 * 最后更新: 2026-09-08（SIT-20260907 观察项 2：非法 objective 返回 400）
 */
import request from 'supertest';
import app from '../../src/app';
import { AppDataSource, initializeDatabase, closeDatabase } from '../../src/config/database';
import { stopJobs } from '../../src/jobs';
import { closeBrowser } from '../../src/services/report.service';
import { stopRateLimitStore } from '../../src/middleware/rateLimit.middleware';
import { memoryCache } from '../../src/utils/memoryCache';
import { Stock } from '../../src/models/Stock';
import { StockDailyBasic } from '../../src/models/StockDailyBasic';
import { FinancialData } from '../../src/models/FinancialData';
import { MarketData } from '../../src/models/MarketData';

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

describe('Optimization Screening Integration Test', () => {
  let token: string;
  let mainPortfolioId: string;
  let degradedPortfolioId: string;

  const testUser = {
    username: 'opt_screen_user',
    email: 'opt_screen@example.com',
    phone: '13800138001',
    password: 'TestPass123!@#',
  };

  // 6 只同行业股票（白酒）：600001~600006
  const STOCKS = [
    { symbol: '600001', name: '测试酒一', pe: 5, pb: 0.8, dv: [3.0, 3.5, 4.0] },
    { symbol: '600002', name: '测试酒二', pe: 30, pb: 4.0, dv: [0, 0, 0] },
    { symbol: '600003', name: '测试酒三', pe: 8, pb: 0.6, dv: [2.5, 3.0, 3.5] },
    { symbol: '600004', name: '测试酒四', pe: 12, pb: 1.5, dv: [0, 0, 4.0] },
    { symbol: '600005', name: '测试酒五', pe: 15, pb: 2.0, dv: [2.2, 2.4, 2.6] },
    { symbol: '600006', name: '测试酒六', pe: 50, pb: 6.0, dv: [] },
  ];
  // 孤立行业股票（降级路径用，无任何基本面数据）
  const ISOLATED = { symbol: '900001', name: '孤立股' };

  const seedFixtures = async () => {
    const stockRepo = AppDataSource.getRepository(Stock);
    const sdbRepo = AppDataSource.getRepository(StockDailyBasic);
    const finRepo = AppDataSource.getRepository(FinancialData);
    const mdRepo = AppDataSource.getRepository(MarketData);

    const stockEntities = new Map<string, Stock>();
    for (const s of [...STOCKS, ISOLATED]) {
      const entity = await stockRepo.save(stockRepo.create({
        symbol: s.symbol, name: s.name, exchange: 'SH', industry: s.symbol === ISOLATED.symbol ? '孤立行业' : '白酒',
      }));
      stockEntities.set(s.symbol, entity);
    }

    // 最新估值快照（2026-09-05）
    for (const s of STOCKS) {
      await sdbRepo.save(sdbRepo.create({
        symbol: s.symbol,
        trade_date: '2026-09-05',
        pe_ttm: s.pe, pb: s.pb, dv_ratio: s.dv.length ? s.dv[2] : null,
        total_mv: 1_000_000, turnover_rate: 2.5,
      }));
      // 股息历史（近 3 个自然年，每年末一条）
      for (let i = 0; i < s.dv.length; i++) {
        const year = 2024 + i;
        await sdbRepo.save(sdbRepo.create({
          symbol: s.symbol,
          trade_date: `${year}-12-31`,
          pe_ttm: s.pe, pb: s.pb, dv_ratio: s.dv[i],
          total_mv: 1_000_000, turnover_rate: 2.5,
        }));
      }
    }

    // 财务数据：600004 营收 +20%；600005 净利 +50%；600006 营收 +22.2%
    const finSeed: [string, string, number | null, number | null][] = [
      ['600004', '2025', 1200, 100], ['600004', '2024', 1000, 100],
      ['600005', '2025', 1050, 300], ['600005', '2024', 1000, 200],
      ['600006', '2025', 1100, 50], ['600006', '2024', 900, 50],
    ];
    for (const [symbol, period, revenue, profit] of finSeed) {
      await finRepo.save(finRepo.create({
        stock_id: stockEntities.get(symbol)!.stock_id,
        report_period: period,
        report_type: 'annual',
        revenue, net_profit: profit,
      }));
    }

    // 行情数据：60 个交易日。各票漂移/波动模式不同，保证协方差矩阵非奇异、优化器可分散权重
    const drifts: Record<string, number> = {
      '600001': 0.004, '600003': 0.003, '600004': 0.0025, '600005': 0.001,
      '600002': -0.001, '600006': 0.0012, '900001': 0.001,
    };
    const today = new Date('2026-09-05');
    const priceRows: Partial<MarketData>[] = [];
    const allSyms = [...STOCKS.map(x => x.symbol), ISOLATED.symbol];
    allSyms.forEach((sym, symIdx) => {
      let price = 10;
      for (let i = 60; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const wave = 0.003 * Math.sin(i * (symIdx + 1) * 0.7);
        price = price * (1 + drifts[sym] + wave);
        priceRows.push({
          symbol: sym,
          trade_date: d.toISOString().slice(0, 10) as any,
          close_price: Number(price.toFixed(4)),
          security_type: 'stock',
          exchange: 'SH',
        });
      }
    });
    await mdRepo.save(mdRepo.create(priceRows));
  };

  const createPortfolioWithHoldings = async (holdings: { symbol: string; name: string; quantity: number; cost_price: number }[]) => {
    const portfolioRes = await request(app)
      .post('/api/v1/portfolios')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Opt-${Date.now()}-${Math.random()}`, type: 'stock' });
    expect(portfolioRes.status).toBe(201);
    const portfolioId = portfolioRes.body.data.portfolio_id;
    for (const h of holdings) {
      const holdingRes = await request(app)
        .post(`/api/v1/holdings/portfolio/${portfolioId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...h, security_type: 'stock', exchange: 'SH' });
      expect(holdingRes.status).toBe(201);
    }
    return portfolioId;
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await initializeDatabase();
    }
    // 主路径要求 TUSHARE_TOKEN 存在（§8 触发条件）；行情/基本面全部来自 fixture
    process.env.TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || 'integration-test-token';

    const registerRes = await request(app).post('/api/v1/auth/register').send(testUser);
    expect(registerRes.status).toBe(201);
    token = registerRes.body.data.token;

    const ackRes = await request(app)
      .post('/api/v1/users/risk-acknowledgment')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(ackRes.status).toBe(200);

    const consentRes = await request(app)
      .post('/api/v1/users/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'optimization_advice', granted_via: 'integration-test' });
    expect(consentRes.status).toBe(200);

    await seedFixtures();

    mainPortfolioId = await createPortfolioWithHoldings([
      { symbol: '600001', name: '测试酒一', quantity: 100, cost_price: 10 },
      { symbol: '600002', name: '测试酒二', quantity: 100, cost_price: 10 },
    ]);
    degradedPortfolioId = await createPortfolioWithHoldings([
      { symbol: '900001', name: '孤立股', quantity: 100, cost_price: 10 },
    ]);
  });

  afterAll(async () => {
    stopRateLimitStore();
    memoryCache.stop();
    await closeDatabase();
    stopJobs();
    await closeBrowser();
  });

  describe('主路径（screening.applied=true）', () => {
    const objectives = ['return_high_yield', 'return_growth', 'return_value', 'return_dividend'];

    for (const objective of objectives) {
      it(`${objective}: screening 块 / screen_score / reason / backtest 齐全`, async () => {
        const res = await request(app)
          .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=${objective}`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const data = res.body.data;
        expect(data.screening.applied).toBe(true);
        expect(data.screening.objective).toBe(objective);
        // 候选池 = 2 持仓 + 4 同行业（600001~600006 并集，上限 200）
        expect(data.screening.universe_size).toBe(6);
        expect(data.screening.passed_count).toBeGreaterThanOrEqual(3);
        expect(data.data_warning).toBeUndefined();

        // 建议含评分与结构化 reason，且按 screen_score 降序
        expect(data.suggestions.length).toBeGreaterThan(0);
        for (const s of data.suggestions) {
          expect(typeof s.reason).toBe('string');
          expect(s.reason.length).toBeGreaterThan(0);
          expect(s.screen_score).not.toBeNull();
          expect(s.screen_score).toBeGreaterThanOrEqual(0);
          expect(s.screen_score).toBeLessThanOrEqual(1);
        }
        for (let i = 1; i < data.suggestions.length; i++) {
          expect(data.suggestions[i - 1].screen_score)
            .toBeGreaterThanOrEqual(data.suggestions[i].screen_score);
        }

        // 回测块补全（§7.3）
        expect(data.backtest.period).toBe('1y');
        expect(data.backtest.trading_days).toBeGreaterThan(0);
        for (const leg of ['current', 'optimized']) {
          for (const field of ['cumulative_return', 'annual_return', 'volatility', 'max_drawdown', 'sharpe']) {
            expect(typeof data.backtest[leg][field]).toBe('number');
          }
        }
        expect(data.backtest.disclaimer).toBe('历史表现不代表未来收益');
      });
    }

    it('return_value: 低 PE 股入选，高 PE 股（600002/600006）出局', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=return_value`)
        .set('Authorization', `Bearer ${token}`);
      const suggested = res.body.data.suggestions.map((s: any) => s.symbol);
      // 池内 PE 中位数 13.5，严格 0.8×13.5=10.8 → 2 只；放宽 0.9×=12.15 → 600001(5)/600003(8)/600004(12) 入选
      expect(suggested).toContain('600001');
      expect(suggested).toContain('600003');
      expect(suggested).not.toContain('600006');
      // 600002 是持仓但 PE=30 未过筛 → 建议调出（权重 0）
      const s2 = res.body.data.suggestions.find((s: any) => s.symbol === '600002');
      if (s2) expect(s2.suggested_weight).toBe(0);
    });

    it('return_dividend: 持续分红股入选，零分红股出局', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=return_dividend`)
        .set('Authorization', `Bearer ${token}`);
      const suggested = res.body.data.suggestions.map((s: any) => s.symbol);
      expect(suggested).toContain('600001');
      expect(suggested).toContain('600003');
      expect(suggested).not.toContain('600002'); // 3 年均 0 分红
    });

    it('return_growth: 营收/净利增长股入选', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=return_growth`)
        .set('Authorization', `Bearer ${token}`);
      const suggested = res.body.data.suggestions.map((s: any) => s.symbol);
      expect(suggested).toContain('600004'); // 营收 +20%
      expect(suggested).toContain('600005'); // 净利 +50%
      expect(suggested).toContain('600006'); // 营收 +22.2%
    });
  });

  describe('降级路径（§8）', () => {
    it('基本面覆盖率 <50% → applied=false + data_warning', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${degradedPortfolioId}/optimize?objective=return_value`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.screening.applied).toBe(false);
      expect(data.screening.reason).toBe('FUNDAMENTAL_DATA_UNAVAILABLE');
      expect(data.screening.universe_size).toBe(1);
      expect(typeof data.data_warning).toBe('string');
      expect(data.data_warning).toContain('基本面数据未就绪');
      // 降级仍产出建议（基于价格），reason 退化为中性文案
      expect(Array.isArray(data.suggestions)).toBe(true);
      for (const s of data.suggestions) {
        expect(typeof s.reason).toBe('string');
      }
    });

    it('risk 目标不受影响（维持传统路径，无 screening 块）', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=risk`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.screening).toBeUndefined();
      expect(res.body.data.data_warning).toBeUndefined();
    });

    it('SIT-20260907 观察项 2：非法 objective（foobar）应返回 400 而非静默走 legacy', async () => {
      const res = await request(app)
        .get(`/api/v1/portfolios/${mainPortfolioId}/optimize?objective=foobar`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Invalid objective');
    });
  });
});
