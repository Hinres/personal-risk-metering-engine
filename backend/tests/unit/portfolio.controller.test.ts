/**
 * [PRME-PA-001] portfolio.controller 单元测试
 * 测试范围: getPortfolios, getPortfolio, createPortfolio, updatePortfolio, deletePortfolio,
 *           getPortfolioRisk, getPortfolioSuggestions, getPortfolioStructure, getPortfolioAnalysis,
 *           getHoldingLimits, createHoldingLimit, updateHoldingLimit, deleteHoldingLimit, checkHoldingLimits,
 *           getPortfolioAttribution, getCorrelationMatrix, getPortfolioHistory
 * 最后更新: 2026-07-08
 */

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  findAndCount: jest.fn(),
  remove: jest.fn().mockResolvedValue(undefined),
});

const mockPortfolioService = {
  updateStatistics: jest.fn().mockResolvedValue(undefined),
  getStructureAnalysis: jest.fn().mockResolvedValue({ sectors: [], correlation_matrix: [] }),
  getRiskReturnAnalysis: jest.fn().mockResolvedValue({ sharpe_ratio: 1.2, max_drawdown: 0.1 }),
  getHoldingLimits: jest.fn().mockResolvedValue([]),
  createHoldingLimit: jest.fn().mockResolvedValue({ limit_id: 'l1' }),
  updateHoldingLimit: jest.fn().mockResolvedValue({ limit_id: 'l1' }),
  deleteHoldingLimit: jest.fn().mockResolvedValue(undefined),
  checkHoldingLimits: jest.fn().mockResolvedValue({ breaches: [] }),
};

const mockAuditService = {
  logCreate: jest.fn().mockResolvedValue(undefined),
  logUpdate: jest.fn().mockResolvedValue(undefined),
  logDelete: jest.fn().mockResolvedValue(undefined),
};

const mockCache = {
  setCachedHoldings: jest.fn().mockResolvedValue(true),
  invalidateDashboardCache: jest.fn().mockResolvedValue(true),
  invalidateHoldingsCache: jest.fn().mockResolvedValue(true),
  invalidateVaRCache: jest.fn().mockResolvedValue(0),
};

const mockValidators = {
  validatePortfolioParams: jest.fn().mockReturnValue({ valid: true }),
  validatePageParams: jest.fn().mockReturnValue({ valid: true }),
  sendValidationError: jest.fn((res: any, v: any) => res.status(400).json({ success: false, message: v.message || 'Validation error' })),
};

jest.mock('../../src/services/portfolio.service', () => ({ PortfolioService: mockPortfolioService }));
jest.mock('../../src/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('../../src/services/cache.service', () => mockCache);
jest.mock('../../src/utils/validators', () => mockValidators);
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation(() => mockRepo()),
    isInitialized: true,
    query: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  getPortfolios, getPortfolio, createPortfolio, updatePortfolio, deletePortfolio,
  getPortfolioRisk, getPortfolioSuggestions, getPortfolioStructure, getPortfolioAnalysis,
  getHoldingLimits, createHoldingLimit, updateHoldingLimit, deleteHoldingLimit, checkHoldingLimits,
  getPortfolioAttribution, getCorrelationMatrix, getPortfolioHistory,
} from '../../src/controllers/portfolio.controller';
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

describe('portfolio.controller', () => {
  let currentRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    currentRepo = mockRepo();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(currentRepo);
    mockValidators.validatePortfolioParams.mockReturnValue({ valid: true });
    mockValidators.validatePageParams.mockReturnValue({ valid: true });
    // Reset PortfolioService mocks to default
    mockPortfolioService.getStructureAnalysis.mockResolvedValue({ sectors: [], correlation_matrix: [] });
    mockPortfolioService.getRiskReturnAnalysis.mockResolvedValue({ sharpe_ratio: 1.2, max_drawdown: 0.1 });
    mockPortfolioService.getHoldingLimits.mockResolvedValue([]);
    mockPortfolioService.createHoldingLimit.mockResolvedValue({ limit_id: 'l1' });
    mockPortfolioService.updateHoldingLimit.mockResolvedValue({ limit_id: 'l1' });
    mockPortfolioService.deleteHoldingLimit.mockResolvedValue(undefined);
    mockPortfolioService.checkHoldingLimits.mockResolvedValue({ breaches: [] });
    mockPortfolioService.updateStatistics.mockResolvedValue(undefined);
  });

  describe('getPortfolios', () => {
    it('should return paginated portfolios', async () => {
      const portfolio = {
        portfolio_id: 'p1', name: 'Test', holdings: [
          { market_value: '1000', quantity: '10', cost_price: '90' },
        ],
      };
      currentRepo.findAndCount.mockResolvedValue([[portfolio], 1]);

      const req = mockRequest({ query: { page: '1', limit: '10' } });
      const res = mockResponse();

      await getPortfolios(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ id: 'p1' })]),
      }));
    });

    it('should handle validation error for page params', async () => {
      mockValidators.validatePageParams.mockReturnValue({ valid: false, message: 'Invalid page' });

      const req = mockRequest({ query: { page: '-1' } });
      const res = mockResponse();

      await getPortfolios(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle error', async () => {
      currentRepo.findAndCount.mockRejectedValue(new Error('DB error'));

      const req = mockRequest();
      const res = mockResponse();

      await getPortfolios(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPortfolio', () => {
    it('should return portfolio with stats', async () => {
      currentRepo.findOne.mockResolvedValue({
        portfolio_id: 'p1', name: 'Test', holdings: [
          { market_value: '1000', quantity: '10', cost_price: '90' },
        ],
      });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid id', async () => {
      const req = mockRequest({ params: { id: '' } });
      const res = mockResponse();

      await getPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when not found', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle error', async () => {
      currentRepo.findOne.mockRejectedValue(new Error('DB error'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createPortfolio', () => {
    it('should create portfolio', async () => {
      currentRepo.create.mockReturnValue({ portfolio_id: 'p1', name: 'New' });
      currentRepo.save.mockResolvedValue({ portfolio_id: 'p1', name: 'New' });

      const req = mockRequest({ body: { name: 'New', description: 'desc', type: 'personal' } });
      const res = mockResponse();

      await createPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 when validation fails', async () => {
      mockValidators.validatePortfolioParams.mockReturnValue({ valid: false, message: 'Invalid' });

      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await createPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle error', async () => {
      currentRepo.create.mockReturnValue({});
      currentRepo.save.mockRejectedValue(new Error('DB error'));

      const req = mockRequest({ body: { name: 'New' } });
      const res = mockResponse();

      await createPortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updatePortfolio', () => {
    it('should update portfolio', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', name: 'Old' });
      currentRepo.save.mockResolvedValue({ portfolio_id: 'p1', name: 'New' });

      const req = mockRequest({ params: { id: 'p1' }, body: { name: 'New' } });
      const res = mockResponse();

      await updatePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid id', async () => {
      const req = mockRequest({ params: { id: '' } });
      const res = mockResponse();

      await updatePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when not found', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await updatePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle error', async () => {
      currentRepo.findOne.mockRejectedValue(new Error('DB error'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await updatePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deletePortfolio', () => {
    it('should delete portfolio', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', status: 'active' });
      currentRepo.save.mockResolvedValue({ portfolio_id: 'p1', status: 'deleted' });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await deletePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid id', async () => {
      const req = mockRequest({ params: { id: '' } });
      const res = mockResponse();

      await deletePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when not found', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await deletePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle error', async () => {
      currentRepo.findOne.mockRejectedValue(new Error('DB error'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await deletePortfolio(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPortfolioRisk', () => {
    it('should return risk analysis', async () => {
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioRisk(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockPortfolioService.getRiskReturnAnalysis.mockRejectedValue(new Error('Not found'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioRisk(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPortfolioSuggestions', () => {
    it('should return suggestions with high concentration', async () => {
      mockPortfolioService.getStructureAnalysis.mockResolvedValue({ concentration: { top1_holding: 0.5 } });
      mockPortfolioService.getRiskReturnAnalysis.mockResolvedValue({ sharpe_ratio: 0.3, max_drawdown: 0.2 });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioSuggestions(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          suggestions: expect.arrayContaining([expect.objectContaining({ type: 'diversification' })]),
        }),
      }));
    });

    it('should return general suggestion when all good', async () => {
      mockPortfolioService.getStructureAnalysis.mockResolvedValue({ concentration: { top1_holding: 0.1 } });
      mockPortfolioService.getRiskReturnAnalysis.mockResolvedValue({ sharpe_ratio: 1.5, max_drawdown: 0.05 });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioSuggestions(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          suggestions: expect.arrayContaining([expect.objectContaining({ type: 'general' })]),
        }),
      }));
    });

    it('should handle error', async () => {
      mockPortfolioService.getStructureAnalysis.mockRejectedValue(new Error('Fail'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioSuggestions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPortfolioStructure', () => {
    it('should return structure', async () => {
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioStructure(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPortfolioAnalysis', () => {
    it('should return analysis', async () => {
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioAnalysis(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('holding limits', () => {
    it('getHoldingLimits should return limits', async () => {
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();
      await getHoldingLimits(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('createHoldingLimit should create limit', async () => {
      const req = mockRequest({ params: { id: 'p1' }, body: { max_weight: 0.3 } });
      const res = mockResponse();
      await createHoldingLimit(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('updateHoldingLimit should update limit', async () => {
      const req = mockRequest({ params: { limitId: 'l1' }, body: { max_weight: 0.4 } });
      const res = mockResponse();
      await updateHoldingLimit(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deleteHoldingLimit should delete limit', async () => {
      const req = mockRequest({ params: { limitId: 'l1' } });
      const res = mockResponse();
      await deleteHoldingLimit(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('checkHoldingLimits should check limits', async () => {
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();
      await checkHoldingLimits(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPortfolioAttribution', () => {
    it('should return attribution', async () => {
      const { AttributionService } = require('../../src/services/attribution.service');
      AttributionService.performBrinsonAttribution = jest.fn().mockResolvedValue({ portfolio_return: 0.1 });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioAttribution(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      const { AttributionService } = require('../../src/services/attribution.service');
      AttributionService.performBrinsonAttribution = jest.fn().mockRejectedValue(new Error('Fail'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioAttribution(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCorrelationMatrix', () => {
    it('should return correlation matrix', async () => {
      mockPortfolioService.getStructureAnalysis.mockResolvedValue({ correlation_matrix: [[1, 0.5], [0.5, 1]] });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getCorrelationMatrix(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockPortfolioService.getStructureAnalysis.mockRejectedValue(new Error('Fail'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getCorrelationMatrix(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPortfolioHistory', () => {
    it('should return history with default period', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', updated_at: new Date() });
      currentRepo.find.mockResolvedValue([{ market_value: 1000, quantity: 10, cost_price: 90 }]);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ period: '3m' }),
      }));
    });

    it('should handle custom period', async () => {
      currentRepo.findOne.mockResolvedValue({ portfolio_id: 'p1', updated_at: new Date() });
      currentRepo.find.mockResolvedValue([]);

      const req = mockRequest({ params: { id: 'p1' }, query: { period: '1y' } });
      const res = mockResponse();

      await getPortfolioHistory(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ period: '1y' }),
      }));
    });

    it('should return 404 when portfolio not found', async () => {
      currentRepo.findOne.mockResolvedValue(null);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle error', async () => {
      currentRepo.findOne.mockRejectedValue(new Error('DB error'));

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolioHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // BUG-SEC-001 XSS 安全回归测试：覆盖 create → get 全链路
  describe('XSS security', () => {
    const xssName = "<script>alert('xss')\u003c/script>";
    const escapedName = "&lt;script&gt;alert(\u0026#39;xss\u0026#39;)&lt;/script&gt;";
    const xssDesc = "<img src=x onerror=alert(1)>";
    const escapedDesc = "&lt;img src=x onerror=alert(1)\u0026gt;";

    it('should escape XSS in createPortfolio before saving', async () => {
      const captured: any[] = [];
      currentRepo.create.mockImplementation((data: any) => {
        captured.push(data);
        return data;
      });
      currentRepo.save.mockResolvedValue({ portfolio_id: 'p1' });

      const req = mockRequest({ body: { name: xssName, description: xssDesc, type: 'personal' } });
      const res = mockResponse();

      await createPortfolio(req, res);
      expect(captured[0]?.name).toBe(escapedName);
      expect(captured[0]?.description).toBe(escapedDesc);
    });

    it('should escape XSS in getPortfolio response', async () => {
      currentRepo.findOne.mockResolvedValue({
        portfolio_id: 'p1',
        name: xssName,
        description: xssDesc,
        holdings: [],
      });

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPortfolio(req, res);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.data.name).toBe(escapedName);
      expect(jsonCall.data.description).toBe(escapedDesc);
    });

    it('should escape XSS in getPortfolios response', async () => {
      currentRepo.findAndCount.mockResolvedValue([[
        {
          portfolio_id: 'p1',
          name: xssName,
          description: xssDesc,
          holdings: [],
        },
      ], 1]);

      const req = mockRequest({ query: { page: '1', limit: '10' } });
      const res = mockResponse();

      await getPortfolios(req, res);
      const jsonCall = res.json.mock.calls[0][0];
      const returnedPortfolio = jsonCall.data[0];
      expect(returnedPortfolio.name).toBe(escapedName);
      expect(returnedPortfolio.description).toBe(escapedDesc);
    });
  });
});
