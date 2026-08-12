/**
 * [PRME-RM-003] holding.controller 单元测试
 * 测试范围: getHoldings, addHolding, updateHolding, deleteHolding
 * 最后更新: 2026-06-20
 */
import * as holdingController from '../../src/controllers/holding.controller';
import { PortfolioService } from '../../src/services/portfolio.service';
import { HoldingService } from '../../src/services/holding.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse } from '../../src/utils/response';

jest.mock('../../src/services/portfolio.service');
jest.mock('../../src/services/holding.service', () => ({
  HoldingService: {
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    normalizeMetadataInput: jest.requireActual('../../src/services/holding.service').HoldingService.normalizeMetadataInput,
  },
}));
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/services/cache.service');
jest.mock('../../src/services/audit.service');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getLatestPrice: jest.fn().mockResolvedValue(null),
  },
}));

const mockReq = (body: any = {}, params: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-agent'),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

const createHoldingRepo = () => {
  const repo = { findOne: jest.fn(), findAndCount: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn(), remove: jest.fn() };
  return repo;
};
const createPortfolioRepo = () => {
  const repo = { findOne: jest.fn(), findAndCount: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn(), remove: jest.fn() };
  return repo;
};

describe('holding.controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getHoldingById', () => {
    it('should return holding detail with frontend-compatible fields', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue({
        holding_id: 'h1',
        portfolio_id: 'p1',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        quantity: 100,
        cost_price: 150,
        metadata: { market: 'US', purchase_date: '2026-01-01', remark: 'test' },
      });
      await holdingController.getHoldingById(req as any, res);
      expect(HoldingService.findOne).toHaveBeenCalledWith('h1', 'u1');
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({
        symbol: 'AAPL',
        market: 'US',
        quantity: 100,
        cost_price: 150,
        purchase_date: '2026-01-01',
        remark: 'test',
      }));
    });

    it('should fall back to exchange when metadata.market is not set', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue({
        holding_id: 'h1',
        portfolio_id: 'p1',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        quantity: 100,
        cost_price: 150,
        metadata: { purchase_date: '2026-01-01', remark: 'test' },
      });
      await holdingController.getHoldingById(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ market: 'NASDAQ' }));
    });

    it('should return empty string when user explicitly cleared metadata.market', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue({
        holding_id: 'h1',
        portfolio_id: 'p1',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        quantity: 100,
        cost_price: 150,
        metadata: { market: '', purchase_date: '2026-01-01', remark: 'test' },
      });
      await holdingController.getHoldingById(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ market: '' }));
    });

    it('should return empty string when metadata.market is null', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue({
        holding_id: 'h1',
        portfolio_id: 'p1',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        quantity: 100,
        cost_price: 150,
        metadata: { market: null, purchase_date: '2026-01-01', remark: 'test' },
      });
      await holdingController.getHoldingById(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ market: '' }));
    });

    it('should return 404 when holding not found', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue(null);
      await holdingController.getHoldingById(req as any, res);
      expect(HoldingService.findOne).toHaveBeenCalledWith('h1', 'u1');
      expect(errorResponse).toHaveBeenCalledWith(res, 'Holding not found', 404);
    });

    it('should return 400 for invalid id', async () => {
      const req = mockReq({}, { id: '' });
      const res = mockRes();
      await holdingController.getHoldingById(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Holding ID is required', 400);
    });

    it('should handle errors', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));
      await holdingController.getHoldingById(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to retrieve holding', 500);
    });
  });

  describe('getHoldings', () => {
    it('should get holdings', async () => {
      const req = mockReq({}, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      await holdingController.getHoldings(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, [{ symbol: 'AAPL' }]);
    });

    it('should handle error', async () => {
      const req = mockReq({}, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockRejectedValue(new Error('DB error'));
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);
      await holdingController.getHoldings(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to fetch holdings', 500);
    });

    it('should return 404 for missing portfolio', async () => {
      const req = mockReq({}, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);
      await holdingController.getHoldings(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio not found', 404);
    });
  });

  describe('addHolding', () => {
    it('should add holding with metadata fields persisted', async () => {
      const req = mockReq({
        symbol: 'AAPL', quantity: 100, cost_price: 150,
        purchase_date: '2026-01-01', remark: 'note', market: 'US'
      }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      holdingRepo.find.mockResolvedValue([]);
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({ breaches: [] });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.addHolding(req as any, res);
      expect(holdingRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: { purchase_date: '2026-01-01', remark: 'note', market: 'US' },
      }));
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding added', 201);
    });

    it('should add holding', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 100, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      holdingRepo.find.mockResolvedValue([]);
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({ breaches: [] });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.addHolding(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding added', 201);
    });

    it('should reject duplicate symbol', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 100, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue({ holding_id: 'h1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      await holdingController.addHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining("already exists"), 409);
    });

    it('should alert on limit breach', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 1000, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      holdingRepo.find.mockResolvedValue([]);
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({
        breaches: [{ limit_type: 'weight', action_on_breach: 'alert', current_weight: 0.5, max_weight: 0.3 }],
      });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.addHolding(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding added', 201);
    });

    it('should reject invalid params', async () => {
      const req = mockReq({ symbol: '', quantity: -1, cost_price: -1 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      await holdingController.addHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.anything(), 400);
    });

    it('should block on limit breach', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 1000, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      holdingRepo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({
        breaches: [{ limit_type: 'weight', action_on_breach: 'block', current_weight: 0.5, max_weight: 0.3 }],
      });
      await holdingController.addHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('持仓限制阻止'), 403);
    });

    it('should handle existing holdings with null market_value in addHolding', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 100, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.findOne.mockResolvedValue(null);
      holdingRepo.find.mockResolvedValue([{ symbol: 'GOOGL', quantity: 10, cost_price: 100, market_value: null, sector: 'tech' }]);
      holdingRepo.create.mockReturnValue({ holding_id: 'h1' });
      holdingRepo.save.mockResolvedValue({ holding_id: 'h1' });
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({ breaches: [] });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.addHolding(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding added', 201);
    });

    it('should return 404 for missing portfolio', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 100, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);
      await holdingController.addHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio not found', 404);
    });

    it('should handle DB error in addHolding', async () => {
      const req = mockReq({ symbol: 'AAPL', quantity: 100, cost_price: 150 }, { portfolioId: 'p1' });
      const res = mockRes();
      const portfolioRepo = createPortfolioRepo();
      portfolioRepo.findOne.mockRejectedValue(new Error('DB error'));
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);
      await holdingController.addHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to add holding', 500);
    });
  });

  describe('updateHolding', () => {
    beforeEach(() => {
      (HoldingService.findOne as jest.Mock).mockReset();
      (HoldingService.update as jest.Mock).mockReset();
    });

    it('should return 404 for missing holding', async () => {
      const req = mockReq({ quantity: 200 }, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue(null);
      await holdingController.updateHolding(req as any, res);
      expect(HoldingService.findOne).toHaveBeenCalledWith('h1', 'u1');
      expect(errorResponse).toHaveBeenCalledWith(res, 'Holding not found', 404);
    });

    it('should block on limit breach', async () => {
      const req = mockReq({ quantity: 200 }, { id: 'h1' });
      const res = mockRes();
      const holding = { holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL', quantity: 100, cost_price: 150, market_value: 15000, metadata: {} };
      (HoldingService.findOne as jest.Mock).mockResolvedValue(holding);
      const holdingRepo = createHoldingRepo();
      holdingRepo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({
        breaches: [{ limit_type: 'weight', action_on_breach: 'block', current_weight: 0.5, max_weight: 0.3 }],
      });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.updateHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('持仓限制阻止'), 403);
    });

    it('should update holding and persist metadata fields', async () => {
      const req = mockReq({ quantity: 200, purchase_date: '2026-01-01', remark: 'note' }, { id: 'h1' });
      const res = mockRes();
      const holding = { holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL', quantity: 100, cost_price: 150, market_value: 15000, metadata: {} };
      (HoldingService.findOne as jest.Mock).mockResolvedValue(holding);
      (HoldingService.update as jest.Mock).mockResolvedValue({ ...holding, quantity: 200, metadata: { purchase_date: '2026-01-01', remark: 'note' } });
      const holdingRepo = createHoldingRepo();
      holdingRepo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({ breaches: [] });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.updateHolding(req as any, res);
      expect(HoldingService.update).toHaveBeenCalledWith('h1', 'u1', { quantity: 200, purchase_date: '2026-01-01', remark: 'note' }, holding);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding updated');
    });

    it('should skip validation when only name/description updated', async () => {
      const req = mockReq({ name: 'Updated Name' }, { id: 'h1' });
      const res = mockRes();
      const holding = { holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL', quantity: 100, cost_price: 150, market_value: 15000, metadata: {} };
      (HoldingService.findOne as jest.Mock).mockResolvedValue(holding);
      (HoldingService.update as jest.Mock).mockResolvedValue({ ...holding, name: 'Updated Name' });
      const holdingRepo = createHoldingRepo();
      holdingRepo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(holdingRepo);
      (PortfolioService.checkHoldingLimits as jest.Mock).mockResolvedValue({ breaches: [] });
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.updateHolding(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Holding updated');
    });

    it('should validate when quantity/cost_price updated with invalid params', async () => {
      const req = mockReq({ quantity: -1 }, { id: 'h1' });
      const res = mockRes();
      const holding = { holding_id: 'h1', portfolio_id: 'p1', symbol: 'AAPL', quantity: 100, cost_price: 150, market_value: 15000, metadata: {} };
      (HoldingService.findOne as jest.Mock).mockResolvedValue(holding);
      await holdingController.updateHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.anything(), 400);
    });

    it('should handle DB error in updateHolding', async () => {
      const req = mockReq({ quantity: 200 }, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));
      await holdingController.updateHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to update holding', 500);
    });
  });

  describe('deleteHolding', () => {
    beforeEach(() => {
      (HoldingService.findOne as jest.Mock).mockReset();
      (HoldingService.delete as jest.Mock).mockReset();
    });

    it('should delete holding', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      const holding = { holding_id: 'h1', portfolio_id: 'p1' };
      (HoldingService.findOne as jest.Mock).mockResolvedValue(holding);
      (HoldingService.delete as jest.Mock).mockResolvedValue(true);
      (PortfolioService.updateStatistics as jest.Mock).mockResolvedValue(undefined);
      await holdingController.deleteHolding(req as any, res);
      expect(HoldingService.findOne).toHaveBeenCalledWith('h1', 'u1');
      expect(HoldingService.delete).toHaveBeenCalledWith('h1', 'u1', holding);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Holding deleted');
    });

    it('should return 404 for missing holding', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockResolvedValue(null);
      await holdingController.deleteHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Holding not found', 404);
    });

    it('should handle DB error in deleteHolding', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();
      (HoldingService.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));
      await holdingController.deleteHolding(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to delete holding', 500);
    });
  });
});
