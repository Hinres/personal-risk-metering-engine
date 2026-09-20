/**
 * [PRME-VAR-001] var.controller 单元测试
 * 测试范围: calculateVaR, getVaRHistory
 * 最后更新: 2026-07-08
 */

// Mock all external dependencies before importing controller
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({ var_id: 'var-1' }),
  findAndCount: jest.fn(),
});

const mockVaRService = { calculate: jest.fn() };
const mockMarketDataService = { getReturnsMatrix: jest.fn() };
const mockMonitorService = { checkPortfolioMonitors: jest.fn().mockResolvedValue(undefined) };
const mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };
const mockCache = {
  getCachedVaR: jest.fn().mockResolvedValue(null),
  setCachedVaR: jest.fn().mockResolvedValue(true),
};
const mockValidators = {
  validateVaRParams: jest.fn().mockReturnValue({ valid: true }),
  sendValidationError: jest.fn((res: any, v: any) => res.status(400).json({ success: false, message: v.message || 'Validation error' })),
};

jest.mock('../../src/services/var.service', () => ({ VaRService: mockVaRService }));
jest.mock('../../src/services/marketData.service', () => ({ MarketDataService: mockMarketDataService }));
jest.mock('../../src/services/monitor.service', () => ({ MonitorService: mockMonitorService }));
jest.mock('../../src/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('../../src/services/cache.service', () => mockCache);
jest.mock('../../src/utils/validators', () => mockValidators);
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock database module
const repos = {
  varRepo: mockRepo(),
  portfolioRepo: mockRepo(),
  holdingRepo: mockRepo(),
};

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation(() => {
      // Return a fresh combined repo for each call
      const r = mockRepo();
      return r;
    }),
    isInitialized: true,
    query: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  },
}));

import { calculateVaR, getVaRHistory } from '../../src/controllers/var.controller';
import { AppDataSource } from '../../src/config/database';

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

const mockRequest = (overrides: any = {}) => ({
  user: { user_id: 'user-1' },
  body: {},
  query: {},
  params: {},
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-agent'),
  ...overrides,
});

describe('var.controller', () => {
  let currentRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    currentRepo = mockRepo();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(currentRepo);
    mockValidators.validateVaRParams.mockReturnValue({ valid: true });
    mockCache.getCachedVaR.mockResolvedValue(null);
    mockVaRService.calculate.mockResolvedValue({
      var_value: 150, var_percentage: 0.15, expected_return: 0.001,
      volatility: 0.02, components: [], risk_factors: [],
    });
    mockMarketDataService.getReturnsMatrix.mockResolvedValue([[0.01], [0.02]]);
  });

  describe('calculateVaR', () => {
    it('should return 400 when validation fails', async () => {
      mockValidators.validateVaRParams.mockReturnValue({ valid: false, message: 'Invalid params' });

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when portfolio not found', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 with zero VaR when portfolio has no holdings', async () => {
      currentRepo.findOne
        .mockResolvedValueOnce({ portfolio_id: 'p1' })
        .mockResolvedValueOnce([]);
      currentRepo.find.mockResolvedValue([]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          var_value: 0,
          var_percentage: 0,
          message: expect.stringContaining('暂无持仓'),
        }),
      }));
    });

    it('should return cached result when cache hit', async () => {
      mockCache.getCachedVaR.mockResolvedValue({ var_value: 100, cached: true });
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ cached: true }),
      }));
    });

    it('should calculate VaR successfully', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockVaRService.calculate).toHaveBeenCalledWith('user-1', 'p1', expect.objectContaining({ method: 'historical' }));
    });

    it('should handle EVT method with estimation_method', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1', method: 'extreme_value', estimation_method: 'mle' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(mockVaRService.calculate).toHaveBeenCalledWith(
        'user-1', 'p1', expect.objectContaining({ method: 'extreme_value', estimation_method: 'mle' })
      );
    });

    it('should fallback when calculation engine fails', async () => {
      mockVaRService.calculate.mockRejectedValue(new Error('timeout'));
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ is_fallback: true }),
      }));
    });

    it('should use default params when not provided', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockVaRService.calculate).toHaveBeenCalledWith('user-1', 'p1', expect.objectContaining({
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
        estimation_method: undefined,
      }));
    });

    it('should use cached result with provided estimation_method', async () => {
      mockCache.getCachedVaR.mockResolvedValue({ var_value: 100, cached: true });
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1', method: 'extreme_value', estimation_method: 'mle' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCache.getCachedVaR).toHaveBeenCalledWith('p1', 'extreme_value', 0.95, 1, 'mle');
    });

    it('should not create var calculation when service returns var_id', async () => {
      mockVaRService.calculate.mockResolvedValue({
        var_id: 'var-existing',
        var_value: 150, var_percentage: 0.15, expected_return: 0.001,
        volatility: 0.02, components: [], risk_factors: [],
      });
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(currentRepo.create).not.toHaveBeenCalled();
    });

    it('should create var calculation with default components and risk factors', async () => {
      mockVaRService.calculate.mockResolvedValue({
        var_value: 150, var_percentage: 0.15, expected_return: 0.001,
        volatility: 0.02,
      });
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);
      currentRepo.create.mockReturnValue({ var_id: 'var-created' });

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(currentRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        var_components: [],
        risk_factors: [],
      }));
    });

    it('should handle outer catch error', async () => {
      currentRepo.findOne.mockRejectedValue(new Error('DB failure'));

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should fallback with market value and empty historical returns', async () => {
      mockVaRService.calculate.mockRejectedValue(new Error('timeout'));
      mockMarketDataService.getReturnsMatrix.mockResolvedValue([]);
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL', market_value: 1000 }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ is_fallback: true }),
      }));
    });

    it('should handle market data unavailable during fallback', async () => {
      mockVaRService.calculate.mockRejectedValue(new Error('timeout'));
      mockMarketDataService.getReturnsMatrix.mockRejectedValue(new Error('unavailable'));
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1' });
      currentRepo.find.mockResolvedValue([{ symbol: 'AAPL' }]);

      const req = mockRequest({ body: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await calculateVaR(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getVaRHistory', () => {
    it('should return own history without portfolio_id filter', async () => {
      currentRepo.find.mockResolvedValue([{ var_id: 'v1' }]);

      const req = mockRequest();
      const res = mockResponse();

      await getVaRHistory(req, res);
      expect(currentRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: 'user-1' } }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return history with portfolio_id filter for owned portfolio', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', user_id: 'user-1' });
      currentRepo.find.mockResolvedValue([{ var_id: 'v1' }]);

      const req = mockRequest({ query: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await getVaRHistory(req, res);
      expect(currentRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { portfolio_id: 'p1', user_id: 'user-1' },
      }));
      expect(currentRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { user_id: 'user-1', portfolio_id: 'p1' },
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when portfolio belongs to another user', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ query: { portfolio_id: 'p1' } });
      const res = mockResponse();

      await getVaRHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(currentRepo.find).not.toHaveBeenCalled();
    });

    it('should handle error', async () => {
      currentRepo.find.mockRejectedValue(new Error('DB error'));

      const req = mockRequest();
      const res = mockResponse();

      await getVaRHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
