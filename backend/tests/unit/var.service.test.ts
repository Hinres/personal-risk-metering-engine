/**
 * [PRME-VAR-001] var.service 单元测试
 * 测试范围: calculate, getHistory, getLatest, deleteOldCalculations
 * 最后更新: 2026-06-24
 */
import { VaRService } from '../../src/services/var.service';
import { AppDataSource } from '../../src/config/database';
import { PortfolioService } from '../../src/services/portfolio.service';
import { MarketDataService } from '../../src/services/marketData.service';

jest.mock('../../src/services/portfolio.service');
jest.mock('../../src/services/marketData.service');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockReturnValue({ var_id: 'v1' }),
  save: jest.fn().mockResolvedValue({ var_id: 'v1' }),
  createQueryBuilder: jest.fn().mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 5 }),
  }),
});

const createMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue(mockRepo()),
});

(Object.assign as any)(AppDataSource, createMockDataSource());

describe('VaRService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculate', () => {
    it('should calculate parametric VaR', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 10, current_price: 100 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v2' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'parametric',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should calculate historical VaR', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', weight: 1 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });
      expect(result).toHaveProperty('var_id');
      expect(result).toHaveProperty('var_value');
    });

    it('should return zero VaR for empty portfolio', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [],
      });

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });

      expect(result).toEqual({
        var_value: 0,
        var_percentage: 0,
        message: '组合暂无持仓，VaR为0',
        portfolio_id: 'p1',
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
        calculated_at: expect.any(String),
      });
    });

    it('should use fallback when market data unavailable', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', weight: 1 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockRejectedValue(new Error('No data'));
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should calculate Monte Carlo VaR', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', weight: 1 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v3' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'monte_carlo',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should calculate extreme value VaR with default PWM estimation', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 10, current_price: 100 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v4' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'extreme_value',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should calculate extreme value VaR with MLE', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', weight: 1 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v4' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'extreme_value',
        estimation_method: 'mle',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should fallback to equal weights when total market value is zero', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [
          { symbol: 'AAPL' },
          { symbol: 'MSFT' },
        ],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01, 0.02])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v6' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });
      expect(result).toHaveProperty('var_id');
    });

    it('should fallback to cost_price when current_price is missing', async () => {
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 10, cost_price: 100 }],
      });
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(
        Array.from({ length: 252 }, () => [0.01])
      );
      const repo = mockRepo();
      repo.save.mockResolvedValue({ var_id: 'v5' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.calculate('u1', 'p1', {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });
      expect(result).toHaveProperty('var_id');
    });
  });

  describe('getHistory', () => {
    it('should return history with portfolio filter', async () => {
      const repo = mockRepo();
      repo.find.mockResolvedValue([{ var_id: 'v1' }, { var_id: 'v2' }]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.getHistory('u1', 'p1', 10);
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { portfolio_id: 'p1' },
        take: 10,
      }));
    });

    it('should return all history without portfolio filter', async () => {
      const repo = mockRepo();
      repo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await VaRService.getHistory('u1');
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: {},
      }));
    });
  });

  describe('getLatest', () => {
    it('should return latest calculation', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ var_id: 'v1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await VaRService.getLatest('p1');
      expect(result).toHaveProperty('var_id');
    });
  });

  describe('deleteOldCalculations', () => {
    it('should delete old calculations with default days', async () => {
      const repo = mockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await VaRService.deleteOldCalculations();
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should delete old calculations', async () => {
      const repo = mockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await VaRService.deleteOldCalculations(30);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });
  });
});
