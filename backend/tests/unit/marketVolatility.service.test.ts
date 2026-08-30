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
});
