/**
 * [PRME-RM-001] monitor.controller 单元测试
 * 测试范围: getDashboard, getMonitors, createMonitor, updateMonitor, deleteMonitor
 * 最后更新: 2026-06-20
 */
import * as monitorController from '../../src/controllers/monitor.controller';
import { MonitorService } from '../../src/services/monitor.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';
import { getCachedDashboard, setCachedDashboard, invalidateMonitorSnapshotCache, invalidateDashboardCache } from '../../src/services/cache.service';

jest.mock('../../src/services/monitor.service');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/services/cache.service');
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
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('monitor.controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const createRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({}),
  });

  describe('getDashboard', () => {
    it('should return cached dashboard when cache hit', async () => {
      const req = mockReq();
      const res = mockRes();
      (getCachedDashboard as jest.Mock).mockResolvedValue({ summary: { portfolio_count: 1 } });
      await monitorController.getDashboard(req as any, res);
      expect(getCachedDashboard).toHaveBeenCalledWith('u1');
      expect(successResponse).toHaveBeenCalledWith(res, { summary: { portfolio_count: 1 }, cached: true }, 'Dashboard (cached)');
    });

    it('should handle dashboard errors', async () => {
      const req = mockReq();
      const res = mockRes();
      const portfolioRepo = createRepo();
      portfolioRepo.find.mockRejectedValue(new Error('db error'));
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(portfolioRepo);
      await monitorController.getDashboard(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to fetch dashboard', 500);
    });

    it('should get dashboard with missing market_value and positive cost', async () => {
      const req = mockReq();
      const res = mockRes();
      const portfolioRepo = createRepo();
      portfolioRepo.find.mockResolvedValue([{ portfolio_id: 'p1', name: 'Test' }]);
      const holdingRepo = createRepo();
      holdingRepo.find.mockResolvedValue([{ quantity: 10, cost_price: 100 }]);
      const varRepo = createRepo();
      varRepo.findOne.mockResolvedValue(null);
      const alertRepo = createRepo();
      const monitorRepo = createRepo();
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(varRepo)
        .mockReturnValueOnce(alertRepo)
        .mockReturnValueOnce(monitorRepo)
        .mockReturnValueOnce(alertRepo);
      await monitorController.getDashboard(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything());
    });

    it('should get dashboard with latest VaR and missing quantity', async () => {
      const req = mockReq();
      const res = mockRes();
      const portfolioRepo = createRepo();
      portfolioRepo.find.mockResolvedValue([{ portfolio_id: 'p1', name: 'Test' }]);
      const holdingRepo = createRepo();
      holdingRepo.find.mockResolvedValue([{ market_value: 1000, quantity: 0, cost_price: 100 }]);
      const varRepo = createRepo();
      varRepo.findOne.mockResolvedValue({ var_value: 100, var_percentage: 10, confidence_level: 95, calculation_type: 'mc', calculated_at: new Date() });
      const alertRepo = createRepo();
      const monitorRepo = createRepo();
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(varRepo)
        .mockReturnValueOnce(alertRepo)
        .mockReturnValueOnce(monitorRepo)
        .mockReturnValueOnce(alertRepo);
      await monitorController.getDashboard(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything());
    });

    it('should get dashboard with zero cost', async () => {
      const req = mockReq();
      const res = mockRes();
      const portfolioRepo = createRepo();
      portfolioRepo.find.mockResolvedValue([{ portfolio_id: 'p1', name: 'Test' }]);
      const holdingRepo = createRepo();
      holdingRepo.find.mockResolvedValue([{ market_value: 1000, quantity: 10, cost_price: 0 }]);
      const varRepo = createRepo();
      varRepo.findOne.mockResolvedValue(null);
      const alertRepo = createRepo();
      const monitorRepo = createRepo();
      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(portfolioRepo)
        .mockReturnValueOnce(holdingRepo)
        .mockReturnValueOnce(varRepo)
        .mockReturnValueOnce(alertRepo)
        .mockReturnValueOnce(monitorRepo)
        .mockReturnValueOnce(alertRepo);
      await monitorController.getDashboard(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.anything());
    });
  });

  describe('getMonitors', () => {
    it('should get monitors', async () => {
      const req = mockReq({}, {}, { portfolio_id: 'p1' });
      const res = mockRes();
      (MonitorService.getMonitors as jest.Mock).mockResolvedValue([{ monitor_id: 'm1' }]);
      await monitorController.getMonitors(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, [{ monitor_id: 'm1' }]);
    });

    it('should handle errors', async () => {
      const req = mockReq();
      const res = mockRes();
      (MonitorService.getMonitors as jest.Mock).mockRejectedValue(new Error('fail'));
      await monitorController.getMonitors(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'fail', 500);
    });
  });

  describe('createMonitor', () => {
    it('should create monitor', async () => {
      const req = mockReq({ portfolio_id: 'p1', monitor_name: 'Test', monitor_type: 'var_threshold', threshold: 0.05, operator: '>' });
      const res = mockRes();
      (MonitorService.create as jest.Mock).mockResolvedValue({ monitor_id: 'm1' });
      await monitorController.createMonitor(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { monitor_id: 'm1' }, 'Monitor created', 201);
    });

    it('should handle validation errors', async () => {
      const req = mockReq({});
      const res = mockRes();
      await monitorController.createMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.anything(), 400);
    });

    it('should handle create monitor errors', async () => {
      const req = mockReq({ portfolio_id: 'p1', monitor_name: 'Test', monitor_type: 'var_threshold', threshold: 0.05, operator: '>' });
      const res = mockRes();
      (MonitorService.create as jest.Mock).mockRejectedValue(new Error('fail'));
      await monitorController.createMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'fail', 400);
    });
  });

  describe('updateMonitor', () => {
    it('should update monitor', async () => {
      const req = mockReq({ threshold: 0.1 }, { id: 'm1' });
      const res = mockRes();
      (MonitorService.update as jest.Mock).mockResolvedValue({ monitor_id: 'm1', portfolio_id: 'p1' });
      await monitorController.updateMonitor(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { monitor_id: 'm1', portfolio_id: 'p1' }, 'Monitor updated');
    });

    it('should reject missing id', async () => {
      const req = mockReq({}, { id: '' });
      const res = mockRes();
      await monitorController.updateMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Monitor ID is required', 400);
    });

    it('should reject non-string id', async () => {
      const req = mockReq({}, { id: 123 });
      const res = mockRes();
      await monitorController.updateMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Monitor ID is required', 400);
    });

    it('should handle errors', async () => {
      const req = mockReq({}, { id: 'm1' });
      const res = mockRes();
      (MonitorService.update as jest.Mock).mockRejectedValue(new Error('not found'));
      await monitorController.updateMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('deleteMonitor', () => {
    it('should delete monitor', async () => {
      const req = mockReq({}, { id: 'm1' });
      const res = mockRes();
      (MonitorService.delete as jest.Mock).mockResolvedValue(undefined);
      await monitorController.deleteMonitor(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Monitor deleted');
    });

    it('should reject missing id', async () => {
      const req = mockReq({}, { id: '' });
      const res = mockRes();
      await monitorController.deleteMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Monitor ID is required', 400);
    });

    it('should reject non-string id on delete', async () => {
      const req = mockReq({}, { id: 123 });
      const res = mockRes();
      await monitorController.deleteMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Monitor ID is required', 400);
    });

    it('should handle errors', async () => {
      const req = mockReq({}, { id: 'm1' });
      const res = mockRes();
      (MonitorService.delete as jest.Mock).mockRejectedValue(new Error('not found'));
      await monitorController.deleteMonitor(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });
});
