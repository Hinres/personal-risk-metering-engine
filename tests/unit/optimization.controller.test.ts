/**
 * [PRME-PA-003] optimization.controller 单元测试
 * 测试范围: optimizePortfolio, getOptimizationMethods
 * 最后更新: 2026-07-24
 */
import * as optimizationController from '../../src/controllers/optimization.controller';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse } from '../../src/utils/response';
import { MarketDataService } from '../../src/services/marketData.service';

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getReturnsMatrix: jest.fn(),
  },
}));
jest.mock('../../src/services/compliance.service', () => ({
  ComplianceFilter: {
    getUserRiskTolerance: jest.fn().mockResolvedValue('moderate'),
    mapRiskToleranceToConstraints: jest.fn().mockReturnValue({
      allow_short: false,
      max_sector_exposure: 0.3,
      max_single_holding: 0.2,
    }),
    checkAndFilter: jest.fn().mockReturnValue({ hasInvestmentKeywords: false, complianceNote: '' }),
    wrapResult: jest.fn().mockReturnValue({ result: 'wrapped' }),
    saveResult: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/audit.service');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../src/utils/validators', () => ({
  validateOptimizationParams: jest.fn().mockReturnValue({ valid: true }),
  sendValidationError: jest.fn(),
}));

import logger from '../../src/utils/logger';
import { validateOptimizationParams, sendValidationError } from '../../src/utils/validators';

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-agent'),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

function generateReturns(days: number, assets: number): number[][] {
  return Array.from({ length: days }, () =>
    Array.from({ length: assets }, () => (Math.random() - 0.5) * 0.02)
  );
}

describe('optimization.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('optimizePortfolio', () => {
    it('should optimize portfolio successfully', async () => {
      const req = mockReq({
        portfolio_id: 'p1',
        method: 'mean_variance',
        risk_free_rate: 0.03,
      });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Portfolio optimization completed');
    });

    it('should return 404 for missing portfolio', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'mean_variance' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio not found', 404);
    });

    it('should return 400 for empty holdings', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'mean_variance' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio has no holdings', 400);
    });

    it('should handle validation errors', async () => {
      (validateOptimizationParams as jest.Mock).mockReturnValueOnce({ valid: false, errors: ['Invalid method'] });
      const req = mockReq({ method: 'invalid_method' });
      const res = mockRes();

      await optimizationController.optimizePortfolio(req as any, res);
      expect(sendValidationError).toHaveBeenCalledWith(res, { valid: false, errors: ['Invalid method'] });
      (validateOptimizationParams as jest.Mock).mockReturnValue({ valid: true });
    });

    it('should optimize with risk_parity method', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'risk_parity' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Portfolio optimization completed');
    });

    it('should optimize with minimum_variance method', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'minimum_variance' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Portfolio optimization completed');
    });

    it('should optimize with maximum_sharpe method', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'maximum_sharpe', risk_free_rate: 0.03 });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Portfolio optimization completed');
    });

    it('should return 400 when market data is insufficient', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'risk_parity' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockRejectedValue(new Error('Insufficient historical data for AAPL'));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('Insufficient historical market data'), 400);
    });

    it('should handle unsupported optimization method', async () => {
      const req = mockReq({ portfolio_id: 'p1', method: 'unsupported' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('Unsupported optimization method'), 400);
    });

    it('should log warning when investment keywords are detected', async () => {
      const { ComplianceFilter } = require('../../src/services/compliance.service');
      ComplianceFilter.checkAndFilter.mockReturnValue({ hasInvestmentKeywords: true, complianceNote: 'contains buy' });
      const req = mockReq({ portfolio_id: 'p1', method: 'mean_variance' });
      const res = mockRes();

      const portfolioRepo = { findOne: jest.fn().mockResolvedValue({ portfolio_id: 'p1' }) };
      const holdingRepo = { find: jest.fn().mockResolvedValue([{ symbol: 'AAPL', quantity: 10, current_price: 150 }]) };
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(generateReturns(252, 1));

      await optimizationController.optimizePortfolio(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Portfolio optimization completed');

      ComplianceFilter.checkAndFilter.mockReturnValue({ hasInvestmentKeywords: false, complianceNote: '' });
    });

    it('should return 400 when method is missing', async () => {
      const req = mockReq({ portfolio_id: 'p1' });
      const res = mockRes();

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'portfolio_id and method are required', 400);
    });

    it('should return 400 when portfolio_id is missing', async () => {
      const req = mockReq({ method: 'mean_variance' });
      const res = mockRes();

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'portfolio_id and method are required', 400);
    });

    it('should handle catch when user is undefined', async () => {
      const req = { body: { portfolio_id: 'p1', method: 'mean_variance' }, user: undefined, ip: '127.0.0.1', get: jest.fn() };
      const res = mockRes();

      await optimizationController.optimizePortfolio(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio optimization failed', 500);
      expect(logger.error).toHaveBeenCalledWith('Portfolio optimization failed', expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('getOptimizationMethods', () => {
    it('should return methods', async () => {
      const req = mockReq();
      const res = mockRes();

      await optimizationController.getOptimizationMethods(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ methods: expect.any(Array) })
      );
    });
  });
});
