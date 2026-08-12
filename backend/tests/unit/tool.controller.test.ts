/**
 * [PRME-TS-001] tool.controller 单元测试
 * 测试范围: calculateToolVaR, getToolVaRHistory, getToolVaRHistoryDetail, savePreset, getPresets, deletePreset
 * 最后更新: 2026-06-24
 */
import * as toolController from '../../src/controllers/tool.controller';
import { ToolService } from '../../src/services/tool.service';
import { AuditService } from '../../src/services/audit.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';
import logger from '../../src/utils/logger';

jest.mock('../../src/services/tool.service');
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

describe('tool.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateToolVaR', () => {
    it('should calculate VaR successfully', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL', quantity: 100 }],
          method: 'historical',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();
      (ToolService.calculateVaR as jest.Mock).mockResolvedValue({ var_value: 1000, var_id: 'var1' });
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);

      await toolController.calculateToolVaR(req as any, res);

      expect(ToolService.calculateVaR).toHaveBeenCalledWith('u1', expect.objectContaining({
        method: 'historical',
        confidence_level: 0.95,
        time_horizon: 1,
        holdings: [{ symbol: 'AAPL', quantity: 100 }],
      }));
      expect(AuditService.log).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(res, { var_value: 1000, var_id: 'var1' }, 'VaR calculation completed');
    });

    it('should return 400 when holdings is missing', async () => {
      const req = mockReq({ method: 'historical', confidence_level: 0.95, time_horizon: 1 });
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'holdings array is required', 400);
      expect(ToolService.calculateVaR).not.toHaveBeenCalled();
    });

    it('should return 400 when holdings is empty', async () => {
      const req = mockReq({ holdings: [], method: 'historical', confidence_level: 0.95, time_horizon: 1 });
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'holdings array is required', 400);
    });

    it('should return 400 when holding is missing symbol', async () => {
      const req = mockReq(
        {
          holdings: [{ quantity: 100 }],
          method: 'historical',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Each holding must have symbol and quantity', 400);
    });

    it('should return 400 when holding quantity is null', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL', quantity: null }],
          method: 'historical',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Each holding must have symbol and quantity', 400);
    });

    it('should return 400 when VaR params are invalid', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL', quantity: 100 }],
          method: 'invalid_method',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, expect.anything(), 400);
      expect(ToolService.calculateVaR).not.toHaveBeenCalled();
    });

    it('should return 400 when holdings is not an array', async () => {
      const req = mockReq({ holdings: 'not-array', method: 'historical', confidence_level: 0.95, time_horizon: 1 });
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'holdings array is required', 400);
    });

    it('should return 400 when holding quantity is undefined', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL' }],
          method: 'historical',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Each holding must have symbol and quantity', 400);
    });

    it('should pass optional monte_carlo_iterations and random_seed', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL', quantity: 100 }],
          method: 'monte_carlo',
          confidence_level: 0.95,
          time_horizon: 1,
          monte_carlo_iterations: 1000,
          random_seed: 42,
          distribution: 'normal',
        }
      );
      const res = mockRes();
      (ToolService.calculateVaR as jest.Mock).mockResolvedValue({ var_value: 1000, var_id: 'var1' });
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);

      await toolController.calculateToolVaR(req as any, res);

      expect(ToolService.calculateVaR).toHaveBeenCalledWith('u1', expect.objectContaining({
        monte_carlo_iterations: 1000,
        random_seed: 42,
      }));
    });

    it('should handle service error without message', async () => {
      const req = mockReq(
        {
          holdings: [{ symbol: 'AAPL', quantity: 100 }],
          method: 'historical',
          confidence_level: 0.95,
          time_horizon: 1,
        }
      );
      const res = mockRes();
      (ToolService.calculateVaR as jest.Mock).mockRejectedValue({});

      await toolController.calculateToolVaR(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'VaR calculation failed', 500);
    });
  });

  describe('getToolVaRHistory', () => {
    it('should get paginated history', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (ToolService.getHistory as jest.Mock).mockResolvedValue({
        history: [{ var_id: 'var1' }],
        total: 1,
        page: 1,
        limit: 10,
      });

      await toolController.getToolVaRHistory(req as any, res);

      expect(paginatedResponse).toHaveBeenCalledWith(res, [{ var_id: 'var1' }], 1, 1, 10);
    });

    it('should use default pagination when not provided', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (ToolService.getHistory as jest.Mock).mockResolvedValue({
        history: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await toolController.getToolVaRHistory(req as any, res);

      expect(ToolService.getHistory).toHaveBeenCalledWith('u1', 1, 20);
      expect(paginatedResponse).toHaveBeenCalled();
    });

    it('should handle error fetching history', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (ToolService.getHistory as jest.Mock).mockRejectedValue(new Error('DB error'));

      await toolController.getToolVaRHistory(req as any, res);

      expect(logger.error).toHaveBeenCalled();
      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('getToolVaRHistoryDetail', () => {
    it('should get history detail', async () => {
      const req = mockReq({}, { id: 'var1' });
      const res = mockRes();
      (ToolService.getHistoryById as jest.Mock).mockResolvedValue({ var_id: 'var1', var_value: 1000 });

      await toolController.getToolVaRHistoryDetail(req as any, res);

      expect(ToolService.getHistoryById).toHaveBeenCalledWith('u1', 'var1');
      expect(successResponse).toHaveBeenCalledWith(res, { var_id: 'var1', var_value: 1000 });
    });

    it('should return 404 when record not found', async () => {
      const req = mockReq({}, { id: 'var1' });
      const res = mockRes();
      (ToolService.getHistoryById as jest.Mock).mockRejectedValue(new Error('Record not found'));

      await toolController.getToolVaRHistoryDetail(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Record not found', 404);
    });
  });

  describe('savePreset', () => {
    it('should save preset', async () => {
      const req = mockReq({ name: 'My Preset', method: 'historical', confidence_level: 0.95 });
      const res = mockRes();
      (ToolService.savePreset as jest.Mock).mockResolvedValue({ preset_id: 'p1', name: 'My Preset' });

      await toolController.savePreset(req as any, res);

      expect(ToolService.savePreset).toHaveBeenCalledWith('u1', 'My Preset', { method: 'historical', confidence_level: 0.95 });
      expect(successResponse).toHaveBeenCalledWith(res, { preset_id: 'p1', name: 'My Preset' }, 'Preset saved');
    });

    it('should return 400 when name is missing', async () => {
      const req = mockReq({ method: 'historical' });
      const res = mockRes();

      await toolController.savePreset(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'name is required', 400);
      expect(ToolService.savePreset).not.toHaveBeenCalled();
    });

    it('should handle error saving preset', async () => {
      const req = mockReq({ name: 'My Preset', method: 'historical' });
      const res = mockRes();
      (ToolService.savePreset as jest.Mock).mockRejectedValue(new Error('Save failed'));

      await toolController.savePreset(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Save failed', 500);
    });
  });

  describe('getPresets', () => {
    it('should get presets', async () => {
      const req = mockReq();
      const res = mockRes();
      (ToolService.getPresets as jest.Mock).mockResolvedValue([{ preset_id: 'p1' }]);

      await toolController.getPresets(req as any, res);

      expect(ToolService.getPresets).toHaveBeenCalledWith('u1');
      expect(successResponse).toHaveBeenCalledWith(res, [{ preset_id: 'p1' }]);
    });

    it('should handle error fetching presets', async () => {
      const req = mockReq();
      const res = mockRes();
      (ToolService.getPresets as jest.Mock).mockRejectedValue(new Error('DB error'));

      await toolController.getPresets(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('deletePreset', () => {
    it('should delete preset', async () => {
      const req = mockReq({}, { name: 'My Preset' });
      const res = mockRes();
      (ToolService.deletePreset as jest.Mock).mockResolvedValue({ success: true });

      await toolController.deletePreset(req as any, res);

      expect(ToolService.deletePreset).toHaveBeenCalledWith('u1', 'My Preset');
      expect(successResponse).toHaveBeenCalledWith(res, { success: true }, 'Preset deleted');
    });

    it('should handle error deleting preset', async () => {
      const req = mockReq({}, { name: 'My Preset' });
      const res = mockRes();
      (ToolService.deletePreset as jest.Mock).mockRejectedValue(new Error('Not found'));

      await toolController.deletePreset(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Not found', 500);
    });
  });
});
