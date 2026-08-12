/**
 * [PRME-INFRA-005] system.controller 单元测试
 * 测试范围: getConfig, setConfig, getAllConfigs, deleteConfig
 * 最后更新: 2026-06-24
 */
import * as systemController from '../../src/controllers/system.controller';
import { SystemService } from '../../src/services/system.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse } from '../../src/utils/response';

jest.mock('../../src/services/system.service');
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

describe('system.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should get config by key', async () => {
      const req = mockReq({}, { key: 'max_var_limit' });
      const res = mockRes();
      (SystemService.getConfig as jest.Mock).mockResolvedValue('10000');

      await systemController.getConfig(req as any, res);

      expect(SystemService.getConfig).toHaveBeenCalledWith('max_var_limit');
      expect(successResponse).toHaveBeenCalledWith(res, { key: 'max_var_limit', value: '10000' });
    });

    it('should return 404 when config not found', async () => {
      const req = mockReq({}, { key: 'unknown_key' });
      const res = mockRes();
      (SystemService.getConfig as jest.Mock).mockRejectedValue(new Error('Config not found'));

      await systemController.getConfig(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Config not found', 404);
    });
  });

  describe('setConfig', () => {
    it('should set config with all fields', async () => {
      const req = mockReq(
        { value: '20000', type: 'number', description: 'Maximum VaR limit' },
        { key: 'max_var_limit' }
      );
      const res = mockRes();
      const updatedConfig = { key: 'max_var_limit', value: '20000', type: 'number', description: 'Maximum VaR limit' };
      (SystemService.setConfig as jest.Mock).mockResolvedValue(updatedConfig);

      await systemController.setConfig(req as any, res);

      expect(SystemService.setConfig).toHaveBeenCalledWith('max_var_limit', '20000', 'number', 'Maximum VaR limit');
      expect(successResponse).toHaveBeenCalledWith(res, updatedConfig, 'Config updated');
    });

    it('should set config with minimal fields', async () => {
      const req = mockReq({ value: 'new_value' }, { key: 'some_key' });
      const res = mockRes();
      const updatedConfig = { key: 'some_key', value: 'new_value' };
      (SystemService.setConfig as jest.Mock).mockResolvedValue(updatedConfig);

      await systemController.setConfig(req as any, res);

      expect(SystemService.setConfig).toHaveBeenCalledWith('some_key', 'new_value', undefined, undefined);
      expect(successResponse).toHaveBeenCalledWith(res, updatedConfig, 'Config updated');
    });

    it('should return 400 when set fails', async () => {
      const req = mockReq({ value: 'x' }, { key: 'bad_key' });
      const res = mockRes();
      (SystemService.setConfig as jest.Mock).mockRejectedValue(new Error('Invalid config value'));

      await systemController.setConfig(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Invalid config value', 400);
    });

    it('should handle empty key in params', async () => {
      const req = mockReq({ value: 'x' }, { key: '' });
      const res = mockRes();
      (SystemService.setConfig as jest.Mock).mockRejectedValue(new Error('Key is required'));

      await systemController.setConfig(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Key is required', 400);
    });
  });

  describe('getAllConfigs', () => {
    it('should get all configs without type filter', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (SystemService.getAllConfigs as jest.Mock).mockResolvedValue([{ key: 'k1', value: 'v1' }, { key: 'k2', value: 'v2' }]);

      await systemController.getAllConfigs(req as any, res);

      expect(SystemService.getAllConfigs).toHaveBeenCalledWith(undefined);
      expect(successResponse).toHaveBeenCalledWith(res, [{ key: 'k1', value: 'v1' }, { key: 'k2', value: 'v2' }]);
    });

    it('should get configs with type filter', async () => {
      const req = mockReq({}, {}, { type: 'number' });
      const res = mockRes();
      (SystemService.getAllConfigs as jest.Mock).mockResolvedValue([{ key: 'k1', value: '100', type: 'number' }]);

      await systemController.getAllConfigs(req as any, res);

      expect(SystemService.getAllConfigs).toHaveBeenCalledWith('number');
      expect(successResponse).toHaveBeenCalledWith(res, [{ key: 'k1', value: '100', type: 'number' }]);
    });

    it('should handle error fetching all configs', async () => {
      const req = mockReq({}, {}, { type: 'number' });
      const res = mockRes();
      (SystemService.getAllConfigs as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      await systemController.getAllConfigs(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB connection failed', 500);
    });
  });

  describe('deleteConfig', () => {
    it('should delete config', async () => {
      const req = mockReq({}, { key: 'old_config' });
      const res = mockRes();
      (SystemService.deleteConfig as jest.Mock).mockResolvedValue(undefined);

      await systemController.deleteConfig(req as any, res);

      expect(SystemService.deleteConfig).toHaveBeenCalledWith('old_config');
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Config deleted');
    });

    it('should handle error deleting config', async () => {
      const req = mockReq({}, { key: 'protected_config' });
      const res = mockRes();
      (SystemService.deleteConfig as jest.Mock).mockRejectedValue(new Error('Cannot delete protected config'));

      await systemController.deleteConfig(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Cannot delete protected config', 500);
    });
  });
});
