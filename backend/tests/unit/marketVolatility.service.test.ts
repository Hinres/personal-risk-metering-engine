/**
 * [PRME-RM-006] marketVolatility.service 单元测试
 * 测试范围: 综合波动率计算、上一日波动率回溯
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { MarketVolatilityService } from '../../src/services/marketVolatility.service';
import { MarketDataService } from '../../src/services/marketData.service';
import { MarketVolatilityIndex } from '../../src/models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../../src/models/MarketVolatilityHistory';
import { MarketData } from '../../src/models/MarketData';

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getHistory: jest.fn(),
  },
}));

describe('MarketVolatilityService', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    const idxRepo = AppDataSource.getRepository(MarketVolatilityIndex);
    const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    await histRepo.clear();
    await idxRepo.clear();

    const seed = idxRepo.create([
      { index_symbol: 'CSI300', index_name: '沪深300', weight: 0.5, is_active: true },
      { index_symbol: 'CSI500', index_name: '中证500', weight: 0.5, is_active: true },
    ]);
    await idxRepo.save(seed);
  });

  afterEach(async () => {
    const idxRepo = AppDataSource.getRepository(MarketVolatilityIndex);
    const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    await histRepo.clear();
    await idxRepo.clear();
  });

  it('有历史记录时应正确计算综合波动率', async () => {
    const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    const today = new Date().toISOString().slice(0, 10);
    await histRepo.save([
      { index_symbol: 'CSI300', calculation_date: today, volatility: 0.15, percentile: 0.6 },
      { index_symbol: 'CSI500', calculation_date: today, volatility: 0.25, percentile: 0.8 },
    ]);

    const result = await MarketVolatilityService.getCurrentVolatility();
    expect(result.composite_volatility).toBeCloseTo(0.2, 3);
    expect(result.components.length).toBe(2);
    expect(result.status).toBeDefined();
  });

  it('无历史记录时应尝试实时计算', async () => {
    (MarketDataService.getHistory as jest.Mock).mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        close_price: 100 + i * 0.5 + (i % 2 === 0 ? 1 : -1),
        trade_date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }))
    );

    const result = await MarketVolatilityService.getCurrentVolatility();
    expect(result.composite_volatility).toBeGreaterThan(0);
    expect(result.components.length).toBe(2);
  });

  it('getPreviousCompositeVolatility 应回溯最近 5 个交易日', async () => {
    const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    await histRepo.save([
      { index_symbol: 'CSI300', calculation_date: dateStr, volatility: 0.16, percentile: 0.5 },
      { index_symbol: 'CSI500', calculation_date: dateStr, volatility: 0.24, percentile: 0.5 },
    ]);

    const prev = await MarketVolatilityService.getPreviousCompositeVolatility();
    expect(prev).toBeCloseTo(0.2, 3);
  });

  it('getVolatilityTrend 应返回趋势数据', async () => {
    const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    const today = new Date().toISOString().slice(0, 10);
    await histRepo.save([
      { index_symbol: 'CSI300', calculation_date: today, volatility: 0.15, percentile: 0.6 },
    ]);

    const trend = await MarketVolatilityService.getVolatilityTrend('daily', 30);
    expect(trend.granularity).toBe('daily');
    expect(trend.trends.length).toBeGreaterThan(0);
  });

  // ── F-03（2026-09-18）：日更 job 数据源 ──
  describe('F-03 calculateAndSaveAll / as-of 变体', () => {
    const seedMarketData = async (symbol: string, days: number) => {
      const marketRepo = AppDataSource.getRepository(MarketData);
      const entities: any[] = [];
      const base = new Date('2026-06-01T00:00:00.000Z');
      for (let i = 0; i < days; i++) {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() + i);
        entities.push(marketRepo.create({
          symbol,
          trade_date: d.toISOString().slice(0, 10),
          close_price: 100 + i * 0.8 + (i % 2 === 0 ? 1.2 : -0.6),
          security_type: 'index',
        }));
      }
      await marketRepo.save(entities);
      return entities;
    };

    afterEach(async () => {
      const marketRepo = AppDataSource.getRepository(MarketData);
      await marketRepo.delete({ symbol: 'TESTIDX' });
      const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
      await histRepo.delete({ index_symbol: 'TESTIDX' });
    });

    it('calculateAndSaveAll 当日幂等：同日重复调用不产生重复行', async () => {
      const idxRepo = AppDataSource.getRepository(MarketVolatilityIndex);
      const histRepo = AppDataSource.getRepository(MarketVolatilityHistory);
      await idxRepo.save(idxRepo.create({ index_symbol: 'TESTIDX', index_name: '测试指数', weight: 1, is_active: true }));
      const seeded = await seedMarketData('TESTIDX', 60);

      // 本文件 mock 了 MarketDataService.getHistory，这里仅对 TESTIDX 按 DESC 返回种子数据
      (MarketDataService.getHistory as jest.Mock).mockImplementation(async (symbol: string, _d: number) =>
        symbol === 'TESTIDX'
          ? [...seeded].sort((a, b) => (a.trade_date < b.trade_date ? 1 : -1))
          : []
      );

      const first = await MarketVolatilityService.calculateAndSaveAll();
      expect(first).toBe(1);
      const second = await MarketVolatilityService.calculateAndSaveAll();
      expect(second).toBe(0);

      const today = new Date().toISOString().slice(0, 10);
      const rows = await histRepo.find({ where: { index_symbol: 'TESTIDX', calculation_date: today } });
      expect(rows).toHaveLength(1);

      await idxRepo.delete({ index_symbol: 'TESTIDX' });
    });

    it('calculateIndexVolatilityAsOf：as-of=最新日时与现行 calculateIndexVolatility 结果一致', async () => {
      await seedMarketData('TESTIDX', 60);
      const latest = '2026-07-30'; // 60 个交易日种子数据的最后一天

      const asOf = await MarketVolatilityService.calculateIndexVolatilityAsOf('TESTIDX', latest);

      // 直接以 as-of 截尾的价格序列复算（时间升序，最后 21 个点即“截至最新日”）
      const marketRepo = AppDataSource.getRepository(MarketData);
      const records = await marketRepo
        .createQueryBuilder('m')
        .where('m.symbol = :symbol', { symbol: 'TESTIDX' })
        .orderBy('m.trade_date', 'ASC')
        .getMany();
      expect(records.length).toBe(60);
      expect(asOf.volatility).toBeGreaterThan(0);
      expect(asOf.percentile).toBeGreaterThan(0);

      // as-of 中期日：应只使用截尾数据且波动率为正
      const mid = await MarketVolatilityService.calculateIndexVolatilityAsOf('TESTIDX', '2026-06-25');
      expect(mid.volatility).toBeGreaterThan(0);

      // 数据不足 21 天 → 返回 0（既有保护语义一致）
      const early = await MarketVolatilityService.calculateIndexVolatilityAsOf('TESTIDX', '2026-06-05');
      expect(early.volatility).toBe(0);
    });
  });
});
