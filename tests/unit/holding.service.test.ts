/**
 * [PRME-RM-003] holding.service 单元测试
 * 测试范围: getByPortfolio, add, update, delete, updatePrices
 * 最后更新: 2026-06-24
 */
import { HoldingService } from '../../src/services/holding.service';
import { AppDataSource } from '../../src/config/database';

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getLatestPrice: jest.fn().mockResolvedValue(null),
  },
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
});

const createMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue(mockRepo()),
});

(Object.assign as any)(AppDataSource, createMockDataSource());

describe('HoldingService', () => {
  describe('normalizeMetadataInput', () => {
    it('should map frontend fields to metadata JSON', () => {
      const metadata = HoldingService.normalizeMetadataInput({
        purchase_date: '2026-01-01',
        remark: 'note',
        market: 'US',
      });
      expect(metadata).toEqual({ purchase_date: '2026-01-01', remark: 'note', market: 'US' });
    });

    it('should keep existing metadata when fields are undefined', () => {
      const metadata = HoldingService.normalizeMetadataInput({ quantity: 200 }, { market: 'US', remark: 'old' });
      expect(metadata).toEqual({ market: 'US', remark: 'old' });
    });

    it('should allow explicit empty string to clear market', () => {
      const metadata = HoldingService.normalizeMetadataInput({ market: '' }, { market: 'US' });
      expect(metadata).toEqual({ market: '' });
    });

    it('should allow explicit null to clear market', () => {
      const metadata = HoldingService.normalizeMetadataInput({ market: null }, { market: 'US' });
      expect(metadata).toEqual({ market: null });
    });
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByPortfolio', () => {
    it('should return holdings', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.find.mockResolvedValue([{ holding_id: 'h1' }]);

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.getByPortfolio('p1', 'u1');
      expect(result).toHaveLength(1);
    });

    it('should throw if portfolio not found', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);

      await expect(HoldingService.getByPortfolio('p1', 'u1')).rejects.toThrow('Portfolio not found');
    });
  });

  describe('findOne', () => {
    it('should return holding by id when user owns portfolio', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', symbol: 'AAPL', portfolio_id: 'p1' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', user_id: 'u1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      const result = await HoldingService.findOne('h1', 'u1');
      expect(result?.holding_id).toBe('h1');
      expect(result?.symbol).toBe('AAPL');
    });

    it('should return null when holding not found', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      const result = await HoldingService.findOne('h1', 'u1');
      expect(result).toBeNull();
    });

    it('should return null when user does not own portfolio', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      const result = await HoldingService.findOne('h1', 'u2');
      expect(result).toBeNull();
    });
  });

  describe('add', () => {
    it('should add holding with metadata fields mapped to metadata', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.add('p1', 'u1', {
        symbol: 'AAPL',
        quantity: 100,
        cost_price: 150,
        purchase_date: '2026-01-01',
        remark: 'note',
        market: 'US',
      });
      expect(result).toHaveProperty('holding_id');
      expect(holdingRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: { purchase_date: '2026-01-01', remark: 'note', market: 'US' },
      }));
    });

    it('should create holding', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.add('p1', 'u1', {
        symbol: 'AAPL',
        quantity: 100,
        cost_price: 150,
      });
      expect(result).toHaveProperty('holding_id');
    });

    it('should throw if portfolio not found', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);

      await expect(HoldingService.add('p1', 'u1', { symbol: 'AAPL', quantity: 1, cost_price: 1 }))
        .rejects.toThrow('Portfolio not found');
    });

    it('should fetch current price from market data when not provided', async () => {
      const { MarketDataService } = require('../../src/services/marketData.service');
      MarketDataService.getLatestPrice.mockResolvedValue(250);

      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.add('p1', 'u1', {
        symbol: 'AAPL',
        quantity: 100,
        cost_price: 150,
      });
      expect(result).toHaveProperty('holding_id');
      expect(holdingRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        current_price: 250,
        market_value: 25000,
      }));
    });

    it('should use provided current price and skip market data lookup', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.add('p1', 'u1', {
        symbol: 'AAPL',
        quantity: 100,
        cost_price: 150,
        current_price: 200,
      });
      expect(result).toHaveProperty('holding_id');
      expect(holdingRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        current_price: 200,
        market_value: 20000,
      }));
    });
  });

  describe('update', () => {
    it('should update holding', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', metadata: {} });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1', quantity: 200 });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.update('h1', 'u1', { quantity: 200 });
      expect(result).toHaveProperty('holding_id');
    });

    it('should map frontend fields to metadata', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', metadata: { market: 'US' } });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      let saved: any;
      holdingRepo.save.mockImplementation((h: any) => {
        saved = h;
        return h;
      });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      await HoldingService.update('h1', 'u1', {
        quantity: 200,
        purchase_date: '2026-01-01',
        remark: 'note',
        market: 'HK',
      });

      expect(saved.metadata).toEqual({ market: 'HK', purchase_date: '2026-01-01', remark: 'note' });
      expect(saved.quantity).toBe(200);
      expect(saved.purchase_date).toBeUndefined();
      expect(saved.remark).toBeUndefined();
      expect(saved.market).toBeUndefined();
    });

    it('should throw if holding not found', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await expect(HoldingService.update('h1', 'u1', {})).rejects.toThrow('Holding not found');
    });

    it('should throw if unauthorized', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      await expect(HoldingService.update('h1', 'u1', {})).rejects.toThrow('Holding not found');
    });
  });

  describe('delete', () => {
    it('should remove holding', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', metadata: {} });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.delete('h1', 'u1');
      expect(result).toBe(true);
    });

    it('should throw if holding not found', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await expect(HoldingService.delete('h1', 'u1')).rejects.toThrow('Holding not found');
    });

    it('should throw if unauthorized to delete', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      await expect(HoldingService.delete('h1', 'u1')).rejects.toThrow('Holding not found');
    });
  });

  describe('refreshHoldingPrice', () => {
    it('should refresh holding price from market data', async () => {
      const { MarketDataService } = require('../../src/services/marketData.service');
      MarketDataService.getLatestPrice.mockResolvedValue(180);

      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL', quantity: 10 });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1', current_price: 180, market_value: 1800 });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.refreshHoldingPrice('h1', 'p1', 'u1');
      expect(result.current_price).toBe(180);
      expect(result.market_value).toBe(1800);
    });

    it('should throw if holding not found', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await expect(HoldingService.refreshHoldingPrice('h1', 'p1', 'u1')).rejects.toThrow('Holding not found');
    });

    it('should throw if unauthorized', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      // 权限校验统一在 Service.findOne，无权限返回 null，因此表现为 Holding not found
      await expect(HoldingService.refreshHoldingPrice('h1', 'p1', 'u1')).rejects.toThrow('Holding not found');
    });

    it('should throw if market data unavailable', async () => {
      const { MarketDataService } = require('../../src/services/marketData.service');
      MarketDataService.getLatestPrice.mockResolvedValue(null);

      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL' });
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(portfolioRepo);

      await expect(HoldingService.refreshHoldingPrice('h1', 'p1', 'u1')).rejects.toThrow('Price data unavailable');
    });
  });

  describe('refreshPortfolioPrices', () => {
    it('should refresh prices for all holdings', async () => {
      const { MarketDataService } = require('../../src/services/marketData.service');
      MarketDataService.getLatestPrice.mockResolvedValue(190);

      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.find.mockResolvedValue([
        { holding_id: 'h1', symbol: 'AAPL', quantity: 10 },
        { holding_id: 'h2', symbol: 'MSFT', quantity: 5 },
      ]);
      holdingRepo.save.mockResolvedValue({});

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.refreshPortfolioPrices('p1', 'u1');
      expect(result).toHaveLength(2);
      expect(holdingRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip holdings with no market data', async () => {
      const { MarketDataService } = require('../../src/services/marketData.service');
      MarketDataService.getLatestPrice.mockResolvedValue(null);

      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = mockRepo();
      holdingRepo.find.mockResolvedValue([{ holding_id: 'h1', symbol: 'AAPL', quantity: 10 }]);

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      const result = await HoldingService.refreshPortfolioPrices('p1', 'u1');
      expect(result).toHaveLength(1);
      expect(holdingRepo.save).not.toHaveBeenCalled();
    });

    it('should throw if portfolio not found', async () => {
      const portfolioRepo = mockRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);

      await expect(HoldingService.refreshPortfolioPrices('p1', 'u1')).rejects.toThrow('Portfolio not found');
    });
  });

  describe('updatePrices', () => {
    it('should update prices for existing holdings', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', quantity: 10 });

      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await HoldingService.updatePrices([{ holding_id: 'h1', current_price: 200 }]);
      expect(holdingRepo.update).toHaveBeenCalledWith('h1', expect.objectContaining({ current_price: 200, market_value: 2000 }));
    });

    it('should skip missing holdings', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue(null);

      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await HoldingService.updatePrices([{ holding_id: 'h1', current_price: 200 }]);
      expect(holdingRepo.update).not.toHaveBeenCalled();
    });

    it('should handle holdings with zero quantity', async () => {
      const holdingRepo = mockRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1', quantity: null });

      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);

      await HoldingService.updatePrices([{ holding_id: 'h1', current_price: 200 }]);
      expect(holdingRepo.update).toHaveBeenCalledWith('h1', expect.objectContaining({ market_value: 0 }));
    });
  });
});
