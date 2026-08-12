/**
 * [PRME-PA-001] loginSecurity.controller 单元测试
 * 测试范围: getLoginHistory, getActiveDevices
 * 最后更新: 2026-07-08
 */

const mockLoginSecurityService = {
  getLoginHistory: jest.fn().mockResolvedValue({ history: [] }),
  getActiveDevices: jest.fn().mockResolvedValue([]),
};

jest.mock('../../src/services/loginSecurity.service', () => ({ LoginSecurityService: mockLoginSecurityService }));

import { getLoginHistory, getActiveDevices } from '../../src/controllers/loginSecurity.controller';

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

const mockRequest = (overrides: any = {}) => ({
  user: { user_id: 'user-1' },
  query: {},
  ...overrides,
});

describe('loginSecurity.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLoginHistory', () => {
    it('should return history with default params', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getLoginHistory(req, res);
      expect(mockLoginSecurityService.getLoginHistory).toHaveBeenCalledWith('user-1', {});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return history with query params', async () => {
      const req = mockRequest({ query: { page: '1', limit: '10', days: '30' } });
      const res = mockResponse();
      await getLoginHistory(req, res);
      expect(mockLoginSecurityService.getLoginHistory).toHaveBeenCalledWith('user-1', { page: 1, limit: 10, days: 30 });
    });

    it('should handle error', async () => {
      mockLoginSecurityService.getLoginHistory.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getLoginHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getActiveDevices', () => {
    it('should return devices', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getActiveDevices(req, res);
      expect(mockLoginSecurityService.getActiveDevices).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockLoginSecurityService.getActiveDevices.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getActiveDevices(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
