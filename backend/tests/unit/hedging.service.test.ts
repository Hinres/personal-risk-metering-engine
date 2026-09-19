/**
 * [PRME-v1.3.2-V2-06] hedging.service 单元测试
 * 测试范围: 双触发/单触发/不触发、HHI 高低、目标仓位对账、空持仓/VaR 缺失降级、属主隔离
 * 最后更新: 2026-09-19
 */
import { AppDataSource } from '../../src/config/database';
import { HedgingService, quantile, pearson } from '../../src/services/hedging.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { VaRCalculation } from '../../src/models/VaRCalculation';
import { MarketVolatilityIndex } from '../../src/models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../../src/models/MarketVolatilityHistory';

describe('HedgingService (V2-06)', () => {
  let userId: string;
  let otherUserId: string;
  let portfolioId: string;
  let emptyPortfolioId: string;
  let indexId: string;

  const makeVar = (portfolio_id: string, var_percentage: number, daysAgo: number) => {
    const repo = AppDataSource.getRepository(VaRCalculation);
    const calculatedAt = new Date();
    calculatedAt.setDate(calculatedAt.getDate() - daysAgo);
    return repo.create({
      portfolio_id,
      user_id: userId,
      calculation_type: 'historical',
      confidence_level: 0.95,
      time_horizon: 1,
      var_value: 10000,
      var_percentage,
      status: 'completed',
      calculated_at: calculatedAt,
    } as Partial<VaRCalculation>);
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const u = userRepo.create({ username: 'test-hedge-user', email: 'hedge@test.com' });
    await userRepo.save(u);
    userId = u.user_id;

    const u2 = userRepo.create({ username: 'test-hedge-other', email: 'hedge-other@test.com' });
    await userRepo.save(u2);
    otherUserId = u2.user_id;

    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const pf = portfolioRepo.create({ user_id: userId, name: '对冲测试组合', type: 'personal', status: 'active', risk_level: 'medium' } as Partial<Portfolio>);
    await portfolioRepo.save(pf);
    portfolioId = (pf as any).portfolio_id;

    const pfEmpty = portfolioRepo.create({ user_id: userId, name: '空组合', type: 'personal', status: 'active' } as Partial<Portfolio>);
    await portfolioRepo.save(pfEmpty);
    emptyPortfolioId = (pfEmpty as any).portfolio_id;

    // 主指数（权重最高）
    const idx = AppDataSource.getRepository(MarketVolatilityIndex).create({
      index_symbol: 'TEST_MAIN',
      index_name: '测试主指数',
      weight: 0.6,
      source: 'test',
      is_active: true,
    } as Partial<MarketVolatilityIndex>);
    await AppDataSource.getRepository(MarketVolatilityIndex).save(idx);
    indexId = (idx as any).index_id;
  });

  afterAll(async () => {
    const holdingRepo = AppDataSource.getRepository(Holding);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const varRepo = AppDataSource.getRepository(VaRCalculation);
    const userRepo = AppDataSource.getRepository(User);
    await varRepo.delete({ user_id: userId });
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: emptyPortfolioId });
    await AppDataSource.getRepository(MarketVolatilityHistory).delete({ index_symbol: 'TEST_MAIN' });
    await AppDataSource.getRepository(MarketVolatilityIndex).delete({ index_id: indexId });
    await userRepo.delete({ user_id: userId });
    await userRepo.delete({ user_id: otherUserId });
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(VaRCalculation).delete({ user_id: userId });
    await AppDataSource.getRepository(MarketVolatilityHistory).delete({ index_symbol: 'TEST_MAIN' });
    await AppDataSource.getRepository(Holding).delete({ portfolio_id: portfolioId });
  });

  const setMarketPercentile = async (p: number) => {
    const h = AppDataSource.getRepository(MarketVolatilityHistory).create({
      index_symbol: 'TEST_MAIN',
      volatility: 0.02,
      percentile: p,
      calculation_date: new Date().toISOString().slice(0, 10),
    } as Partial<MarketVolatilityHistory>);
    await AppDataSource.getRepository(MarketVolatilityHistory).save(h);
  };

  /** 10 条 VaR：0.01~0.0109（80 分位≈0.0172），最新 0.03 明显高于分位 */
  const seedVarSeries = async (latest = 0.03) => {
    const repo = AppDataSource.getRepository(VaRCalculation);
    for (let i = 9; i >= 1; i--) {
      await repo.save(makeVar(portfolioId, 0.01 + (9 - i) * 0.0001, i));
    }
    await repo.save(makeVar(portfolioId, latest, 0));
  };

  const seedHoldings = async () => {
    const holdingRepo = AppDataSource.getRepository(Holding);
    await holdingRepo.save([
      // HHI = 0.8² + 0.2² = 0.68 > 0.3；白酒占 80% > 40%
      holdingRepo.create({ portfolio_id: portfolioId, symbol: '600519', name: '贵州茅台', quantity: 100, cost_price: 1600, market_value: 80000, sector: '白酒', status: 'active' } as Partial<Holding>),
      holdingRepo.create({ portfolio_id: portfolioId, symbol: '600276', name: '恒瑞医药', quantity: 100, cost_price: 45, market_value: 20000, sector: '医药', status: 'active' } as Partial<Holding>),
    ]);
  };

  it('纯函数回归：quantile / pearson 已知值对账', () => {
    expect(quantile([1, 2, 3, 4], 0.8)).toBeCloseTo(3.4, 10);
    expect(quantile([5], 0.8)).toBe(5);
    expect(quantile([], 0.8)).toBeNaN();
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('双触发：VaR 高于 80 分位 + 市场分位 ≥0.8 → needs_hedging=true 且三类建议齐全', async () => {
    await seedVarSeries();
    await setMarketPercentile(0.85);
    // 行业再平衡需要行情数据，此处无 market_data → sector 建议跳过，其余两类在
    const r: any = await HedgingService.getAdvice(portfolioId, userId);

    expect(r.needs_hedging).toBe(true);
    expect(r.triggers).toEqual(expect.arrayContaining(['portfolio_var_high', 'market_volatility_high']));
    expect(r.advice.some((a: any) => a.type === 'defensive_asset')).toBe(true);
    expect(r.disclaimer).toContain('不构成投资建议');
  });

  it('HHI>0.3 时生成仓位建议且目标仓位按 risk_level=medium（10%）对账', async () => {
    await seedVarSeries(0.03); // 最新 VaR 3%
    await setMarketPercentile(0.5); // 市场不触发，仅组合条件
    await seedHoldings();

    const r: any = await HedgingService.getAdvice(portfolioId, userId);
    expect(r.needs_hedging).toBe(true);
    expect(r.triggers).toEqual(['portfolio_var_high']);

    const pos = r.advice.find((a: any) => a.type === 'position');
    expect(pos).toBeTruthy();
    // target/current = 0.10/0.03 = 3.33 → min(1, x) = 1 → 取整 5% → 1.0
    expect(pos.suggested_weight_range[1]).toBe(1);
    expect(pos.suggested_weight_range[0]).toBeCloseTo(0.95, 10);
  });

  it('目标仓位计算：VaR 高于上限时按比例缩减（0.10/0.20=0.5 → 区间 0.45~0.55）', async () => {
    await seedVarSeries(0.20); // 最新 VaR 20% > medium 上限 10% → 建议仓位 50%
    await setMarketPercentile(0.5);
    await seedHoldings();
    let r: any = await HedgingService.getAdvice(portfolioId, userId);
    let pos = r.advice.find((a: any) => a.type === 'position');
    expect(pos.suggested_weight_range).toEqual([0.45, 0.55]);

    await AppDataSource.getRepository(VaRCalculation).delete({ user_id: userId });
    await seedVarSeries(0.08); // 0.10/0.08=1.25 → min(1,x)=1 → 区间 0.95~1.0
    r = await HedgingService.getAdvice(portfolioId, userId);
    pos = r.advice.find((a: any) => a.type === 'position');
    expect(pos.suggested_weight_range[1]).toBe(1);
    expect(pos.suggested_weight_range[0]).toBeCloseTo(0.95, 10);
  });

  it('HHI ≤ 0.3 时不生成仓位建议（等权两票 HHI=0.5？改用 5 票等权 HHI=0.2）', async () => {
    await seedVarSeries();
    await setMarketPercentile(0.5);
    const holdingRepo = AppDataSource.getRepository(Holding);
    // 5 只等权：HHI = 5×0.2² = 0.2
    for (let i = 1; i <= 5; i++) {
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId, symbol: `60000${i}`, quantity: 100, cost_price: 10,
        market_value: 20000, sector: `行业${i}`, status: 'active',
      } as Partial<Holding>));
    }

    const r: any = await HedgingService.getAdvice(portfolioId, userId);
    expect(r.needs_hedging).toBe(true);
    expect(r.advice.some((a: any) => a.type === 'position')).toBe(false);
  });

  it('不触发：VaR 平稳 + 市场分位低 → needs_hedging=false，advice 空', async () => {
    // 全部 VaR 相同 → 最新不高于 80 分位
    const repo = AppDataSource.getRepository(VaRCalculation);
    for (let i = 5; i >= 0; i--) {
      await repo.save(makeVar(portfolioId, 0.02, i));
    }
    await setMarketPercentile(0.3);

    const r: any = await HedgingService.getAdvice(portfolioId, userId);
    expect(r.needs_hedging).toBe(false);
    expect(r.triggers).toEqual([]);
    expect(r.advice).toEqual([]);
  });

  it('VaR 缺失降级：needs_hedging=false + advice 空 + 提示文案', async () => {
    const r: any = await HedgingService.getAdvice(portfolioId, userId);
    expect(r.needs_hedging).toBe(false);
    expect(r.advice).toEqual([]);
    expect(r.note).toContain('VaR');
  });

  it('属主隔离：其他用户查询 → 404；空组合无 VaR → 降级（needs_hedging=false + 提示）', async () => {
    await expect(HedgingService.getAdvice(portfolioId, otherUserId)).rejects.toMatchObject({ statusCode: 404 });

    const r: any = await HedgingService.getAdvice(emptyPortfolioId, userId);
    expect(r.portfolio_id).toBe(emptyPortfolioId);
    expect(r.needs_hedging).toBe(false);
    expect(r.note).toContain('VaR');
    expect(r.advice).toEqual([]);
  });
});
