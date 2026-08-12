/**
 * [PRME-INFRA-004-UT] valuation.controller 单元测试
 * 测试范围: searchStocks, getStockDetail, calculateValuation, getValuationHistory, getValuationMethods
 * 最后更新: 2026-07-24
 */
import * as valuationController from '../../src/controllers/valuation.controller';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse } from '../../src/utils/response';
import {
  validateValuationParams,
  validateSearchKeyword,
  sendValidationError,
  validatePageParams,
} from '../../src/utils/validators';
import * as valuationCalc from '../../src/calculation/valuation';

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    query: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/validators');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

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

describe('valuation.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchStocks', () => {
    it('should return matching stocks', async () => {
      const req = mockReq({}, {}, { keyword: 'AAPL' });
      const res = mockRes();
      const mockStocks = [{ stock_id: 's1', symbol: 'AAPL', name: 'Apple Inc.' }];
      const stockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue(mockStocks),
        }),
      };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);
      (validateSearchKeyword as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.searchStocks(req as any, res);

      expect(successResponse).toHaveBeenCalledWith(res, mockStocks);
    });

    it('should return validation error for invalid keyword', async () => {
      const req = mockReq({}, {}, { keyword: '' });
      const res = mockRes();
      (validateSearchKeyword as jest.Mock).mockReturnValue({ valid: false, errors: ['keyword is required'] });
      (sendValidationError as jest.Mock).mockReturnValue(res);

      await valuationController.searchStocks(req as any, res);

      expect(sendValidationError).toHaveBeenCalledWith(res, { valid: false, errors: ['keyword is required'] });
    });

    it('should return 500 on database error', async () => {
      const req = mockReq({}, {}, { keyword: 'AAPL' });
      const res = mockRes();
      const stockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);
      (validateSearchKeyword as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.searchStocks(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to search stocks', 500);
    });
  });

  describe('getStockDetail', () => {
    it('should return stock detail with latest financial data', async () => {
      const req = mockReq({}, { symbol: 'AAPL' });
      const res = mockRes();
      const mockStock = { stock_id: 's1', symbol: 'AAPL', name: 'Apple Inc.' };
      const mockFinancial = { financial_id: 'f1', stock_id: 's1', report_period: '2024-Q1' };

      const stockRepo = { findOne: jest.fn().mockResolvedValue(mockStock) };
      const financialRepo = { findOne: jest.fn().mockResolvedValue(mockFinancial) };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(stockRepo)
        .mockReturnValueOnce(financialRepo);

      await valuationController.getStockDetail(req as any, res);

      expect(successResponse).toHaveBeenCalledWith(res, { stock: mockStock, latest_financial: mockFinancial });
    });

    it('should return 404 when stock not found', async () => {
      const req = mockReq({}, { symbol: 'AAPL' });
      const res = mockRes();
      const stockRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);

      await valuationController.getStockDetail(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Stock not found', 404);
    });

    it('should return 500 on database error', async () => {
      const req = mockReq({}, { symbol: 'AAPL' });
      const res = mockRes();
      const stockRepo = { findOne: jest.fn().mockRejectedValue(new Error('DB error')) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);

      await valuationController.getStockDetail(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to get stock detail', 500);
    });
  });

  describe('calculateValuation', () => {
    it('should calculate PE valuation and save record successfully', async () => {
      const req = mockReq({
        symbol: 'AAPL',
        method: 'pe',
        inputs: { eps: 10, pe_ratio: 15 },
      });
      const res = mockRes();
      const mockStock = { stock_id: 's1', symbol: 'AAPL', name: 'Apple Inc.' };
      const mockFinancial = { financial_id: 'f1', stock_id: 's1' };
      const mockRecord = { valuation_id: 'v1', stock_id: 's1' };

      const stockRepo = { findOne: jest.fn().mockResolvedValue(mockStock) };
      const financialRepo = { findOne: jest.fn().mockResolvedValue(mockFinancial) };
      const valuationRepo = {
        create: jest.fn().mockReturnValue(mockRecord),
        save: jest.fn().mockResolvedValue(mockRecord),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(stockRepo)
        .mockReturnValueOnce(financialRepo)
        .mockReturnValue(valuationRepo);
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.calculateValuation(req as any, res);

      expect(valuationRepo.create).toHaveBeenCalled();
      expect(valuationRepo.save).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ method: 'pe', valuation_id: 'v1' }),
        'Valuation calculated successfully'
      );
    });

    it('should return validation error for invalid params', async () => {
      const req = mockReq({ symbol: '' });
      const res = mockRes();
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: false, errors: ['symbol is required'] });
      (sendValidationError as jest.Mock).mockReturnValue(res);

      await valuationController.calculateValuation(req as any, res);

      expect(sendValidationError).toHaveBeenCalledWith(res, { valid: false, errors: ['symbol is required'] });
    });

    it('should return 404 when stock not found', async () => {
      const req = mockReq({ symbol: 'AAPL', method: 'pe', inputs: {} });
      const res = mockRes();
      const stockRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.calculateValuation(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Stock not found', 404);
    });

    it('should return 400 for unsupported valuation method', async () => {
      const req = mockReq({ symbol: 'AAPL', method: 'invalid_method', inputs: {} });
      const res = mockRes();
      const mockStock = { stock_id: 's1', symbol: 'AAPL' };
      const stockRepo = { findOne: jest.fn().mockResolvedValue(mockStock) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(stockRepo);
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.calculateValuation(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Unsupported valuation method: invalid_method', 400);
    });

    it('should return 400 on embedded engine validation error', async () => {
      const req = mockReq({ symbol: 'AAPL', method: 'dcf', inputs: { free_cash_flow: -100, growth_rates: [0.1] } });
      const res = mockRes();
      const mockStock = { stock_id: 's1', symbol: 'AAPL' };
      const mockFinancial = { financial_id: 'f1' };
      const stockRepo = { findOne: jest.fn().mockResolvedValue(mockStock) };
      const financialRepo = { findOne: jest.fn().mockResolvedValue(mockFinancial) };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(stockRepo)
        .mockReturnValueOnce(financialRepo);
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.calculateValuation(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Free cash flow must be positive', 400);
    });

    it('should return 500 on general calculation error', async () => {
      const req = mockReq({ symbol: 'AAPL', method: 'pe', inputs: { eps: 10, pe_ratio: 15 } });
      const res = mockRes();
      const mockStock = { stock_id: 's1', symbol: 'AAPL' };
      const mockFinancial = { financial_id: 'f1' };
      const stockRepo = { findOne: jest.fn().mockResolvedValue(mockStock) };
      const financialRepo = { findOne: jest.fn().mockResolvedValue(mockFinancial) };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(stockRepo)
        .mockReturnValueOnce(financialRepo);
      (validateValuationParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      const spy = jest.spyOn(valuationCalc, 'calculatePEValuation').mockImplementation(() => {
        throw new Error('Unexpected engine error');
      });

      await valuationController.calculateValuation(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Valuation calculation failed', 500);
      spy.mockRestore();
    });
  });

  describe('getValuationHistory', () => {
    it('should return valuation history', async () => {
      const req = mockReq({}, {}, { stock_id: 's1', method: 'pe', limit: '30' });
      const res = mockRes();
      const mockHistory = [{ valuation_id: 'v1', stock_id: 's1', method: 'pe' }];
      const valuationRepo = { find: jest.fn().mockResolvedValue(mockHistory) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(valuationRepo);
      (validatePageParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.getValuationHistory(req as any, res);

      expect(valuationRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { stock_id: 's1', method: 'pe' },
        take: 30,
        relations: ['stock'],
      }));
      expect(successResponse).toHaveBeenCalledWith(res, mockHistory);
    });

    it('should return validation error for invalid page params', async () => {
      const req = mockReq({}, {}, { limit: '200' });
      const res = mockRes();
      (validatePageParams as jest.Mock).mockReturnValue({ valid: false, errors: ['limit must be <= 100'] });
      (sendValidationError as jest.Mock).mockReturnValue(res);

      await valuationController.getValuationHistory(req as any, res);

      expect(sendValidationError).toHaveBeenCalledWith(res, { valid: false, errors: ['limit must be <= 100'] });
    });

    it('should return 500 on database error', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      const valuationRepo = { find: jest.fn().mockRejectedValue(new Error('DB error')) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(valuationRepo);
      (validatePageParams as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await valuationController.getValuationHistory(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to fetch valuation history', 500);
    });
  });

  describe('getValuationMethods', () => {
    it('should return valuation methods from embedded engine', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();

      await valuationController.getValuationMethods(req as any, res);

      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ methods: expect.any(Array) })
      );
    });
  });
});
