/**
 * [PRME-v1.3-PA-003] optimizationScreening 单元测试
 * 测试范围: hardScreen / scorePool / normalizeWeights / computeGrowthRates /
 *           percentileRanks / fundamentalCoverage / computeBacktest / calculateMaxDrawdown / screen 降级触发
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §6/§8/§10
 * 最后更新: 2026-09-06
 */
import {
  hardScreen, scorePool, normalizeWeights, computeGrowthRates, percentileRanks,
  computeBacktest, OptimizationScreening, CandidateInfo,
} from '../../src/calculation/optimizationScreening';
import { calculateMaxDrawdown } from '../../src/calculation/risk';

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
  },
}));
jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getHistory: jest.fn(),
    getReturnsMatrix: jest.fn(),
    getDailyBasic: jest.fn(),
    getFinancialReport: jest.fn(),
  },
}));
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

import { AppDataSource } from '../../src/config/database';

const makeCandidate = (overrides: Partial<CandidateInfo> = {}): CandidateInfo => ({
  symbol: '600001',
  name: '测试股',
  industry: '白酒',
  is_holding: false,
  pe_ttm: null, pb: null, total_mv: null, turnover_rate: 2,
  period_return: null, annual_return: null, sharpe: null,
  revenue_growth: null, profit_growth: null,
  dv_by_year: [],
  score: null, reason: null,
  ...overrides,
});

describe('percentileRanks', () => {
  it('favorable 指标：最大者分位为 1', () => {
    const r = percentileRanks([1, 2, 3, null], false);
    expect(r.get(2)).toBe(1);
    expect(r.get(0)).toBeCloseTo(1 / 3);
  });

  it('升序指标（ascending）：最小者分位为 1', () => {
    const r = percentileRanks([10, 20, 30], true);
    expect(r.get(0)).toBe(1);
    expect(r.get(2)).toBeCloseTo(1 / 3);
  });

  it('并列取平均秩', () => {
    const r = percentileRanks([5, 5, 10], false);
    expect(r.get(0)).toBe(r.get(1));
    expect(r.get(2)).toBe(1);
  });
});

describe('computeGrowthRates（§4.4 口径）', () => {
  const fin = (period: string, type: string, revenue: number | null, profit: number | null) =>
    ({ report_period: period, report_type: type, revenue, net_profit: profit } as any);

  it('两份年报：同比 = (本期-同期)/|同期|', () => {
    const g = computeGrowthRates([
      fin('2025', 'annual', 1200, 300),
      fin('2024', 'annual', 1000, 200),
    ]);
    expect(g.revenue_growth).toBeCloseTo(0.2);
    expect(g.profit_growth).toBeCloseTo(0.5);
  });

  it('同期 ≤ 0 标记 null', () => {
    const g = computeGrowthRates([
      fin('2025', 'annual', 1200, 300),
      fin('2024', 'annual', 0, -50),
    ]);
    expect(g.revenue_growth).toBeNull();
    expect(g.profit_growth).toBeNull();
  });

  it('不足两份年报退回最近两季季报', () => {
    const g = computeGrowthRates([
      fin('2025', 'annual', 1200, null),
      fin('2026Q2', 'quarterly', 600, 150),
      fin('2026Q1', 'quarterly', 500, 100),
    ]);
    expect(g.profit_growth).toBeCloseTo(0.5);
  });
});

describe('hardScreen（§6.1）', () => {
  describe('return_high_yield', () => {
    const pool = [
      makeCandidate({ symbol: 'A', period_return: 0.30 }),
      makeCandidate({ symbol: 'B', period_return: 0.10 }),
      makeCandidate({ symbol: 'C', period_return: -0.05 }),
      makeCandidate({ symbol: 'D', period_return: -0.20 }),
    ];

    it('严格档：正收益且池内前 50%', () => {
      const passed = hardScreen({ objective: 'return_high_yield', pool, relaxed: false });
      expect([...passed].sort()).toEqual(['A', 'B']);
    });

    it('负收益不通过；放宽档（前 60%）纳入更多正收益股', () => {
      const rets = [0.35, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05, 0.02, -0.05, -0.20];
      const p = rets.map((r, i) => makeCandidate({ symbol: `S${i}`, period_return: r }));
      const strict = hardScreen({ objective: 'return_high_yield', pool: p, relaxed: false });
      expect(strict.size).toBe(5); // 严格前 50%：截断在 0.15
      expect(strict.has('S5')).toBe(false); // 0.10 未入严格档
      const relaxed = hardScreen({ objective: 'return_high_yield', pool: p, relaxed: true });
      expect(relaxed.has('S5')).toBe(true);  // 放宽前 60% 纳入 0.10
      expect(relaxed.has('S8')).toBe(false); // 负收益仍排除
    });
  });

  describe('return_growth', () => {
    it('营收同比 > 10% 通过', () => {
      const passed = hardScreen({
        objective: 'return_growth',
        pool: [makeCandidate({ symbol: 'A', revenue_growth: 0.11, profit_growth: null })],
        relaxed: false,
      });
      expect(passed.has('A')).toBe(true);
    });

    it('净利润同比 > 10% 通过（营收 null）', () => {
      const passed = hardScreen({
        objective: 'return_growth',
        pool: [makeCandidate({ symbol: 'A', revenue_growth: null, profit_growth: 0.105 })],
        relaxed: false,
      });
      expect(passed.has('A')).toBe(true);
    });

    it('恰为 10% 不通过（严格大于）；放宽档 5% 通过', () => {
      const c = makeCandidate({ symbol: 'A', revenue_growth: 0.10, profit_growth: null });
      expect(hardScreen({ objective: 'return_growth', pool: [c], relaxed: false }).size).toBe(0);
      expect(hardScreen({ objective: 'return_growth', pool: [c], relaxed: true }).has('A')).toBe(true);
    });

    it('两者皆 null 不通过', () => {
      const passed = hardScreen({
        objective: 'return_growth',
        pool: [makeCandidate({ symbol: 'A' })], relaxed: false,
      });
      expect(passed.size).toBe(0);
    });
  });

  describe('return_value', () => {
    const pool = [
      makeCandidate({ symbol: 'A', pe_ttm: 5 }),
      makeCandidate({ symbol: 'B', pe_ttm: 30 }),
      makeCandidate({ symbol: 'C', pe_ttm: 8, pb: 0.5 }),
      makeCandidate({ symbol: 'D', pe_ttm: 9 }),
      makeCandidate({ symbol: 'E', pe_ttm: 15 }),
      makeCandidate({ symbol: 'F', pe_ttm: 50 }),
    ]; // 池内 PE 中位数 = (9+15)/2 = 12，0.8×12 = 9.6

    it('PE 低于行业中枢 80% 通过', () => {
      const passed = hardScreen({ objective: 'return_value', pool, relaxed: false });
      expect(passed.has('A')).toBe(true);
      expect(passed.has('C')).toBe(true);
      expect(passed.has('D')).toBe(true); // 9 < 9.6
      expect(passed.has('E')).toBe(false); // 15 高于 9.6
      expect(passed.has('F')).toBe(false);
    });

    it('负 PE 剔除', () => {
      const p = [...pool, makeCandidate({ symbol: 'G', pe_ttm: -3 })];
      const passed = hardScreen({ objective: 'return_value', pool: p, relaxed: false });
      expect(passed.has('G')).toBe(false);
    });

    it('PB 条件可独立通过', () => {
      const p = [
        makeCandidate({ symbol: 'A', pe_ttm: 20, pb: 0.3 }),
        makeCandidate({ symbol: 'B', pe_ttm: 20, pb: 5 }),
        makeCandidate({ symbol: 'C', pe_ttm: 20, pb: 2 }),
        makeCandidate({ symbol: 'D', pe_ttm: 20, pb: 3 }),
        makeCandidate({ symbol: 'E', pe_ttm: 20, pb: 4 }),
      ]; // pb 中位数 3，0.8×3=2.4
      const passed = hardScreen({ objective: 'return_value', pool: p, relaxed: false });
      expect(passed.has('A')).toBe(true);
      expect(passed.has('B')).toBe(false);
    });

    it('放宽档 0.9×中位数', () => {
      // pe [13,14,16,18,20] 中位数 16；0.8×16=12.8 → 严格无通过；0.9×16=14.4 → 13/14 通过
      const p = [13, 14, 16, 18, 20].map((pe, i) =>
        makeCandidate({ symbol: `S${i}`, pe_ttm: pe }));
      expect(hardScreen({ objective: 'return_value', pool: p, relaxed: false }).size).toBe(0);
      const relaxed = hardScreen({ objective: 'return_value', pool: p, relaxed: true });
      expect(relaxed.size).toBe(2);
    });
  });

  describe('return_dividend', () => {
    it('≥2 年分红且 3 年平均 > 2% 通过', () => {
      const passed = hardScreen({
        objective: 'return_dividend',
        pool: [makeCandidate({ symbol: 'A', dv_by_year: [
          { year: 2024, dv_ratio: 3 }, { year: 2025, dv_ratio: 3.5 }, { year: 2026, dv_ratio: 4 },
        ] })],
        relaxed: false,
      });
      expect(passed.has('A')).toBe(true);
    });

    it('仅 1 年分红不通过', () => {
      const passed = hardScreen({
        objective: 'return_dividend',
        pool: [makeCandidate({ symbol: 'A', dv_by_year: [
          { year: 2024, dv_ratio: 0 }, { year: 2025, dv_ratio: 0 }, { year: 2026, dv_ratio: 4 },
        ] })],
        relaxed: false,
      });
      expect(passed.size).toBe(0);
    });

    it('平均 1.8% 严格不通过、放宽（1.5%）通过', () => {
      const c = makeCandidate({ symbol: 'A', dv_by_year: [
        { year: 2024, dv_ratio: 1.6 }, { year: 2025, dv_ratio: 1.8 }, { year: 2026, dv_ratio: 2.0 },
      ] });
      expect(hardScreen({ objective: 'return_dividend', pool: [c], relaxed: false }).size).toBe(0);
      expect(hardScreen({ objective: 'return_dividend', pool: [c], relaxed: true }).has('A')).toBe(true);
    });
  });
});

describe('scorePool（§6.2）', () => {
  it('高收益：收益与夏普加权分位，越大越高分', () => {
    const pool = [
      makeCandidate({ symbol: 'A', annual_return: 0.3, sharpe: 1.5 }),
      makeCandidate({ symbol: 'B', annual_return: 0.1, sharpe: 0.5 }),
      makeCandidate({ symbol: 'C', annual_return: -0.1, sharpe: -0.5 }),
    ];
    const scores = scorePool('return_high_yield', pool);
    expect(scores.get('A')).toBeGreaterThan(scores.get('B')!);
    expect(scores.get('B')).toBeGreaterThan(scores.get('C')!);
    expect(pool.find(c => c.symbol === 'A')!.reason).toContain('近1年收益池内前');
  });

  it('成长：null 项由另一项双倍权重顶替；两者皆 null 剔除', () => {
    const pool = [
      makeCandidate({ symbol: 'A', revenue_growth: 0.2, profit_growth: null }),
      makeCandidate({ symbol: 'B', revenue_growth: 0.1, profit_growth: 0.1 }),
      makeCandidate({ symbol: 'C', revenue_growth: null, profit_growth: null }),
    ];
    const scores = scorePool('return_growth', pool);
    expect(scores.has('C')).toBe(false);
    expect(scores.get('A')).toBe(1); // 单项即满分位，双倍权重归一后仍为 1
    expect(pool.find(c => c.symbol === 'A')!.reason).toContain('营收同比+20.0%');
    expect(pool.find(c => c.symbol === 'C')!.score).toBeNull();
  });

  it('价值：1/PE 越大分位越高', () => {
    const pool = [
      makeCandidate({ symbol: 'A', pe_ttm: 5, pb: 1 }),
      makeCandidate({ symbol: 'B', pe_ttm: 50, pb: 5 }),
    ];
    const scores = scorePool('return_value', pool);
    expect(scores.get('A')).toBeGreaterThan(scores.get('B')!);
    expect(pool.find(c => c.symbol === 'A')!.reason).toContain('PE(TTM) 5.0');
  });

  it('股息：平均分位 0.6 + 持续性 0.4', () => {
    const pool = [
      makeCandidate({ symbol: 'A', dv_by_year: [
        { year: 2024, dv_ratio: 4 }, { year: 2025, dv_ratio: 4 }, { year: 2026, dv_ratio: 4 },
      ] }),
      makeCandidate({ symbol: 'B', dv_by_year: [
        { year: 2024, dv_ratio: 1 }, { year: 2025, dv_ratio: 1 }, { year: 2026, dv_ratio: 1 },
      ] }),
    ];
    const scores = scorePool('return_dividend', pool);
    expect(scores.get('A')).toBeGreaterThan(scores.get('B')!);
    // A：dv 分位 1 → 0.6×1 + 0.4×(3/3) = 1
    expect(scores.get('A')).toBeCloseTo(1);
    expect(pool.find(c => c.symbol === 'A')!.reason).toContain('连续3年分红');
  });

  // TASK-2（2026-09-17 Kernel 拍板，方案 B）：持续性评分分母 = 实际有快照的年份数
  it('TASK-2: 2 年快照且均分红 → 硬筛选通过，评分分母=2（continuity=1.0）', () => {
    const pool = [
      makeCandidate({ symbol: 'NEW', dv_by_year: [
        { year: 2025, dv_ratio: 3 }, { year: 2026, dv_ratio: 3.2 },
      ] }),
      makeCandidate({ symbol: 'OLD', dv_by_year: [
        { year: 2024, dv_ratio: 2 }, { year: 2025, dv_ratio: 2 }, { year: 2026, dv_ratio: 2 },
      ] }),
    ];
    // 硬筛选：新股（2 年快照均分红）有意放宽通过
    const passed = hardScreen({ objective: 'return_dividend', pool, relaxed: false });
    expect(passed.has('NEW')).toBe(true);

    const scores = scorePool('return_dividend', pool);
    const cNew = pool.find(c => c.symbol === 'NEW')!;
    // NEW 平均股息率池内最高 → 分位 dp=1；continuity = 2/2 = 1.0（分母=实际快照年数）
    // 期望 score = 0.6×1 + 0.4×1.0 = 1.0；若误用固定分母 3 则仅为 0.6+0.4×(2/3)≈0.867
    expect(scores.get('NEW')).toBeCloseTo(1, 6);
    expect(cNew.reason).toContain('连续2年分红');
  });

  it('TASK-2: 3 年快照 2 年分红 → 通过，评分=0.6×分位+0.4×(2/3)', () => {
    const pool = [
      makeCandidate({ symbol: 'A', dv_by_year: [
        { year: 2024, dv_ratio: 3.2 }, { year: 2025, dv_ratio: 3.0 }, { year: 2026, dv_ratio: 0 },
      ] }),
      makeCandidate({ symbol: 'B', dv_by_year: [
        { year: 2024, dv_ratio: 1 }, { year: 2025, dv_ratio: 1 }, { year: 2026, dv_ratio: 1 },
      ] }),
    ];
    const passed = hardScreen({ objective: 'return_dividend', pool, relaxed: false });
    expect(passed.has('A')).toBe(true);

    const scores = scorePool('return_dividend', pool);
    const a = pool.find(c => c.symbol === 'A')!;
    // 手工复算：avg(A)=7/3 > avg(B)=1 → 池内分位 dp=1；continuity=2/3
    expect(scores.get('A')).toBeCloseTo(0.6 * 1 + 0.4 * (2 / 3), 6);
    expect(a.reason).toContain('连续2年分红');
  });

  it('TASK-2: 评分分母不再出现固定 3（1 年快照按 1/1=1.0 计）', () => {
    const pool = [
      makeCandidate({ symbol: 'SOLO', dv_by_year: [{ year: 2026, dv_ratio: 2.5 }] }),
      makeCandidate({ symbol: 'B', dv_by_year: [
        { year: 2024, dv_ratio: 1 }, { year: 2025, dv_ratio: 1 }, { year: 2026, dv_ratio: 1 },
      ] }),
    ];
    const scores = scorePool('return_dividend', pool);
    // 单年数据：continuity = 1/1 = 1.0；若分母固定为 3 则 continuity 仅为 1/3
    const solo = pool.find(c => c.symbol === 'SOLO')!;
    expect(scores.has('SOLO')).toBe(true);
    expect(solo.score!).toBeGreaterThan(0.6 + 0.4 / 3);
  });
});

describe('normalizeWeights（§6.3）', () => {
  const noSector = () => null;

  it('单票超限投影截断 + 归一化（5 票、上限 20% 可行）', () => {
    const w = normalizeWeights({ A: 0.6, B: 0.1, C: 0.1, D: 0.1, E: 0.1 }, noSector, { max_single: 0.2, max_sector: 1 });
    expect(w.A).toBeLessThanOrEqual(0.2 + 1e-6);
    for (const s of ['B', 'C', 'D', 'E']) expect(w[s]).toBeLessThanOrEqual(0.2 + 1e-6);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('行业超限按比例收缩（约束可行：2 行业 × 50% ≥ 1）', () => {
    const industry = (s: string) => (s === 'A' || s === 'B' ? '白酒' : '银行');
    const w = normalizeWeights({ A: 0.3, B: 0.3, C: 0.4 }, industry, { max_single: 0.7, max_sector: 0.5 });
    expect(w.A + w.B).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('水填充后单票与行业均满足约束（约束可行）', () => {
    const industry = (s: string) => (s.startsWith('X') ? '同' : '异');
    // 单票 0.3、同 行业 0.5：X1 触单票上限后剩余额度在同/异间再分配
    const w = normalizeWeights(
      { X1: 0.4, X2: 0.2, Y1: 0.1, Y2: 0.1, Y3: 0.1, Y4: 0.1 },
      industry,
      { max_single: 0.3, max_sector: 0.5 }
    );
    expect(w.X1).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(w.X1 + w.X2).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('空权重原样返回', () => {
    expect(normalizeWeights({}, noSector, { max_single: 0.2, max_sector: 0.4 })).toEqual({});
  });
});

describe('fundamentalCoverage / 降级触发（§8）', () => {
  it('覆盖率 < 50% 触发降级', () => {
    const pool = [
      makeCandidate({ symbol: 'A', pe_ttm: 10 }),
      makeCandidate({ symbol: 'B' }),
      makeCandidate({ symbol: 'C' }),
    ];
    expect(OptimizationScreening.fundamentalCoverage(pool)).toBeCloseTo(1 / 3);
  });

  it('screen()：无 TUSHARE_TOKEN → FUNDAMENTAL_DATA_UNAVAILABLE', async () => {
    delete process.env.TUSHARE_TOKEN;
    const stockRepo = { find: jest.fn().mockResolvedValue([]) };
    const dailyBasicRepo = { query: jest.fn().mockResolvedValue([]) };
    const financialRepo = { find: jest.fn().mockResolvedValue([]) };
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity.name === 'Stock') return stockRepo;
      if (entity.name === 'StockDailyBasic') return dailyBasicRepo;
      if (entity.name === 'FinancialData') return financialRepo;
      return {};
    });
    const holdings = [{ symbol: '600001', name: '测试', quantity: 100, cost_price: 10 } as any];
    const outcome = await OptimizationScreening.screen(holdings, 'return_value');
    expect(outcome.applied).toBe(false);
    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toBe('FUNDAMENTAL_DATA_UNAVAILABLE');
  });

  it('screen()：池过筛后 <3 → SCREENED_POOL_TOO_SMALL', async () => {
    process.env.TUSHARE_TOKEN = 'test-token';
    const stockRepo = { find: jest.fn().mockResolvedValue([]) };
    const dailyBasicRepo = { query: jest.fn().mockResolvedValue([]) };
    const financialRepo = { find: jest.fn().mockResolvedValue([]) };
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity.name === 'Stock') return stockRepo;
      if (entity.name === 'StockDailyBasic') return dailyBasicRepo;
      if (entity.name === 'FinancialData') return financialRepo;
      return {};
    });
    jest.spyOn(OptimizationScreening, 'fundamentalCoverage').mockReturnValue(0.9);
    jest.spyOn(OptimizationScreening, 'enrichPrices').mockResolvedValue(undefined);
    const holdings = [{ symbol: '600001', name: '测试', quantity: 100, cost_price: 10 } as any];
    const outcome = await OptimizationScreening.screen(holdings, 'return_value');
    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toBe('SCREENED_POOL_TOO_SMALL');
    jest.restoreAllMocks();
  });
});

describe('calculateMaxDrawdown（§7.3 复用）', () => {
  it('空数组返回 0', () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });

  it('单边上涨无回撤', () => {
    expect(calculateMaxDrawdown([0.01, 0.02, 0.01])).toBe(0);
  });

  it('典型回撤序列', () => {
    // 净值 1 → 1.1 → 0.88，回撤 = (0.88-1.1)/1.1 = -0.2
    const dd = calculateMaxDrawdown([0.1, -0.2]);
    expect(dd).toBeCloseTo(-0.2);
  });
});

describe('computeBacktest（§7.3）', () => {
  it('当前与建议权重各生成一条净值曲线指标', () => {
    const matrix = [
      [0.01, 0.02],
      [0.01, -0.01],
      [-0.02, 0.01],
    ];
    const bt = computeBacktest(
      matrix,
      ['A', 'B'],
      { A: 1 },
      { A: 0.5, B: 0.5 }
    );
    expect(bt.period).toBe('1y');
    expect(bt.trading_days).toBe(3);
    expect(bt.current.cumulative_return).toBeCloseTo((1.01 * 1.01 * 0.98) - 1);
    expect(bt.optimized.cumulative_return).toBeCloseTo(
      (1 + 0.5 * 0.01 + 0.5 * 0.02) * (1 + 0.5 * 0.01 + 0.5 * -0.01) * (1 + 0.5 * -0.02 + 0.5 * 0.01) - 1
    );
    expect(bt.current.max_drawdown).toBeLessThan(0);
    expect(bt.disclaimer).toBe('历史表现不代表未来收益');
  });
});
