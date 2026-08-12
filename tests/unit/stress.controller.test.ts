/**
 * [PRME-VAR-003] stress.controller 单元测试
 * 测试范围: getScenarios, runStressTest
 * 最后更新: 2026-06-20
 */
import * as stressController from '../../src/controllers/stress.controller';
import { PortfolioService } from '../../src/services/portfolio.service';
import { AuditService } from '../../src/services/audit.service';
import { successResponse, errorResponse } from '../../src/utils/response';
import * as stressCalc from '../../src/calculation/stress';
import { AppDataSource } from '../../src/config/database';

jest.mock('../../src/services/portfolio.service');
jest.mock('../../src/services/audit.service');
jest.mock('../../src/utils/response');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    }),
  },
}));
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }, path: string = '/stress/test') => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
  path,
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('stress.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getScenarios', () => {
    it('should get scenarios', async () => {
      const req = mockReq();
      const res = mockRes();
      jest.spyOn(stressCalc, 'getScenarios').mockReturnValue({
        scenario1: { name: 'Test', description: 'Desc', shocks: {} },
      });
      await stressController.getScenarios(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.arrayContaining([expect.objectContaining({ id: 'scenario1', name: 'Test' })]));
    });

    it('should handle error (500)', async () => {
      const req = mockReq();
      const res = mockRes();
      jest.spyOn(stressCalc, 'getScenarios').mockImplementation(() => {
        throw new Error('scenario error');
      });
      await stressController.getScenarios(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to fetch scenarios', 500);
    });
  });

  describe('runStressTest', () => {
    it('should run stress test with historical scenario', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'scenario1' });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150, sector: 'tech', industry: 'software', weight: 1 }],
      });
      jest.spyOn(stressCalc, 'getScenario').mockReturnValue({ name: '2008 Crisis', description: 'Desc', shocks: { marketDecline: -0.3 } });
      jest.spyOn(stressCalc, 'calculateStressedPortfolio').mockReturnValue({ portfolio_value: 10000, stressed_value: 7000, loss_amount: 3000, loss_percentage: 0.3, asset_results: [], shocks_applied: {} });
      await stressController.runStressTest(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Stress test completed');
    });

    it('should run stress test with custom scenario', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'custom', scenario_name: 'My Scenario', shocks: { marketDecline: -0.1 } });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150, sector: 'tech', industry: 'software', weight: 1 }],
      });
      jest.spyOn(stressCalc, 'calculateStressedPortfolio').mockReturnValue({ portfolio_value: 10000, stressed_value: 9000, loss_amount: 1000, loss_percentage: 0.1, asset_results: [], shocks_applied: {} });
      await stressController.runStressTest(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Stress test completed');
    });

    it('should return 400 for empty portfolio', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'scenario1' });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({ portfolio_id: 'p1', holdings: [] });
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Portfolio has no holdings', 400);
    });

    it('should return 404 for missing scenario', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'unknown' });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150 }],
      });
      jest.spyOn(stressCalc, 'getScenario').mockReturnValue(undefined);
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Scenario not found', 404);
    });

    it('should run custom scenario via custom path with valid market_shock', async () => {
      const req = mockReq(
        { portfolio_id: 'p1', scenario_id: 'scenario1', parameters: { market_shock: -0.2 } },
        {}, {}, { user_id: 'u1' },
        '/stress/custom'
      );
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150, sector: 'tech', industry: 'software', weight: 1 }],
      });
      jest.spyOn(stressCalc, 'calculateStressedPortfolio').mockReturnValue({ portfolio_value: 10000, stressed_value: 8000, loss_amount: 2000, loss_percentage: 0.2, asset_results: [], shocks_applied: {} });
      await stressController.runStressTest(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything(), 'Stress test completed');
    });

    it('should return 400 for invalid market_shock in custom scenario', async () => {
      const req = mockReq(
        { portfolio_id: 'p1', scenario_id: 'custom', parameters: { market_shock: 2.0 } },
        {}, {}, { user_id: 'u1' },
        '/stress/custom'
      );
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150, sector: 'tech', industry: 'software', weight: 1 }],
      });
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'parameters.market_shock must be between -1.0 and 1.0', 400);
    });

    it('should return 404 when custom scenario has no shocks', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'custom' });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockResolvedValue({
        portfolio_id: 'p1',
        holdings: [{ symbol: 'AAPL', quantity: 100, current_price: 150, sector: 'tech', industry: 'software', weight: 1 }],
      });
      jest.spyOn(stressCalc, 'getScenario').mockReturnValue(undefined);
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Scenario not found', 404);
    });

    it('should handle unexpected error (500)', async () => {
      const req = mockReq({ portfolio_id: 'p1', scenario_id: 'scenario1' });
      const res = mockRes();
      (PortfolioService.getById as jest.Mock).mockRejectedValue(new Error('db crash'));
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db crash', 500);
    });

    it('should handle validation errors', async () => {
      const req = mockReq({ portfolio_id: '', scenario_id: '' });
      const res = mockRes();
      await stressController.runStressTest(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.anything(), 400);
    });
  });

  describe('getStressHistory', () => {
    it('should get stress history', async () => {
      const req = mockReq({}, {}, { portfolio_id: 'p1' });
      const res = mockRes();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([{ stress_id: 's1' }]),
      });
      await stressController.getStressHistory(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, [{ stress_id: 's1' }]);
    });

    it('should handle error (500)', async () => {
      const req = mockReq({}, {}, { portfolio_id: 'p1' });
      const res = mockRes();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('db error')),
      });
      await stressController.getStressHistory(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db error', 500);
    });

    it('should get stress history without portfolio filter', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([{ stress_id: 's1' }, { stress_id: 's2' }]),
      });
      await stressController.getStressHistory(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, [{ stress_id: 's1' }, { stress_id: 's2' }]);
    });
  });
});
