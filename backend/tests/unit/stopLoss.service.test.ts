/**
 * [PRME-RM-004] stopLoss.service 单元测试
 * 测试范围: basis 字段输出、风险等级、持久化
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { StopLossService } from '../../src/services/stopLoss.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { MarketDataService } from '../../src/services/marketData.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getLatestPrice: jest.fn(),
    getHistory: jest.fn(),
  },
}));

describe('StopLossService', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);

    const user = userRepo.create({ username: 'test-sl-user', email: 'sl@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: '止损测试组合',
      type: 'personal',
      status: 'active',
    });
    await portfolioRepo.save(portfolio);
    portfolioId = portfolio.portfolio_id;

    const holding = holdingRepo.create({
      portfolio_id: portfolioId,
      symbol: '000001',
      name: '平安银行',
      quantity: 100,
      cost_price: 10,
      current_price: 12,
      security_type: 'stock',
      currency: 'CNY',
      status: 'active',
    });
    await holdingRepo.save(holding);
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const stopLossRepo = AppDataSource.getRepository('StopLossSuggestion');
    await stopLossRepo.delete({ portfolio_id: portfolioId });
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('B-03: basis 字段应直接返回原始字符串枚举值', async () => {
    (MarketDataService.getLatestPrice as jest.Mock).mockResolvedValue(12);
    (MarketDataService.getHistory as jest.Mock).mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        close_price: 10 + Math.sin(i) * 0.5,
        trade_date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }))
    );

    const result = await StopLossService.generateSuggestion(portfolioId, userId, {
      confidence_level: 0.95,
      time_horizon: 1,
      dimension: ['stock'],
      basis: 'var',
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
    const suggestion = result.suggestions[0];
    expect(['var', 'max_drawdown', 'custom']).toContain(suggestion.basis);
    expect(suggestion.basis).toBe('var');
    expect(suggestion.basis).not.toMatch(/^var_\d+_/); // 不应包含旧的错误格式
  });

  it('custom basis 时应返回 custom', async () => {
    (MarketDataService.getLatestPrice as jest.Mock).mockResolvedValue(12);

    const result = await StopLossService.generateSuggestion(portfolioId, userId, {
      confidence_level: 0.95,
      time_horizon: 1,
      dimension: ['stock'],
      basis: 'custom',
      custom_thresholds: { stock: 0.07 },
    });

    expect(result.suggestions[0].basis).toBe('custom');
    expect(result.suggestions[0].stop_loss_pct).toBe(0.07);
  });

  it('应持久化建议历史', async () => {
    (MarketDataService.getLatestPrice as jest.Mock).mockResolvedValue(12);
    (MarketDataService.getHistory as jest.Mock).mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        close_price: 10 + Math.sin(i) * 0.5,
        trade_date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }))
    );

    await StopLossService.generateSuggestion(portfolioId, userId, {
      confidence_level: 0.95,
      time_horizon: 1,
      dimension: ['stock'],
      basis: 'var',
    });

    const history = await StopLossService.getHistory(portfolioId, userId, 1, 10);
    expect(history.total).toBeGreaterThanOrEqual(1);
    expect(history.list[0].suggestions).toBeInstanceOf(Array);
  });
});
