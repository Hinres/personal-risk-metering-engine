/**
 * [PRME-PA-001] marketAlert.controller 单元测试
 * 测试范围: getMyAlerts, acknowledgeAlert, acknowledgeAllAlerts, getAlertStats, getUnreadCount
 * 最后更新: 2026-07-08
 */

const mockMarketAlertService = {
  getUserAlerts: jest.fn().mockResolvedValue({ alerts: [], total: 0 }),
  acknowledgeAlert: jest.fn().mockResolvedValue({ success: true }),
  acknowledgeAllAlerts: jest.fn().mockResolvedValue({ acknowledged_count: 5 }),
  getAlertStats: jest.fn().mockResolvedValue({ total_alerts_30d: 10, acknowledged_count: 5 }),
  getUnacknowledgedCount: jest.fn().mockResolvedValue(3),
};

jest.mock('../../src/services/marketAlert.service', () => ({ MarketAlertService: mockMarketAlertService }));

import { getMyAlerts, acknowledgeAlert, acknowledgeAllAlerts, getAlertStats, getUnreadCount } from '../../src/controllers/marketAlert.controller';

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

const mockRequest = (overrides: any = {}) => ({
  user: { user_id: 'user-1' },
  query: {},
  params: {},
  ...overrides,
});

describe('marketAlert.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyAlerts', () => {
    it('should return alerts with defaults', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getMyAlerts(req, res);
      expect(mockMarketAlertService.getUserAlerts).toHaveBeenCalledWith('user-1', {});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return alerts with filters', async () => {
      const req = mockRequest({ query: { acknowledged: 'true', days: '7', page: '1', limit: '10' } });
      const res = mockResponse();
      await getMyAlerts(req, res);
      expect(mockMarketAlertService.getUserAlerts).toHaveBeenCalledWith('user-1', {
        acknowledged: true, days: 7, page: 1, limit: 10,
      });
    });

    it('should handle acknowledged=false', async () => {
      const req = mockRequest({ query: { acknowledged: 'false' } });
      const res = mockResponse();
      await getMyAlerts(req, res);
      expect(mockMarketAlertService.getUserAlerts).toHaveBeenCalledWith('user-1', {
        acknowledged: false,
      });
    });

    it('should handle acknowledged=invalid', async () => {
      const req = mockRequest({ query: { acknowledged: 'invalid' } });
      const res = mockResponse();
      await getMyAlerts(req, res);
      expect(mockMarketAlertService.getUserAlerts).toHaveBeenCalledWith('user-1', {
        acknowledged: null,
      });
    });

    it('should handle error', async () => {
      mockMarketAlertService.getUserAlerts.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getMyAlerts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert', async () => {
      const req = mockRequest({ params: { id: 'a1' } });
      const res = mockResponse();
      await acknowledgeAlert(req, res);
      expect(mockMarketAlertService.acknowledgeAlert).toHaveBeenCalledWith('user-1', 'a1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid id', async () => {
      const req = mockRequest({ params: { id: '' } });
      const res = mockResponse();
      await acknowledgeAlert(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle error', async () => {
      mockMarketAlertService.acknowledgeAlert.mockRejectedValue(new Error('DB error'));
      const req = mockRequest({ params: { id: 'a1' } });
      const res = mockResponse();
      await acknowledgeAlert(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('acknowledgeAllAlerts', () => {
    it('should acknowledge all', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await acknowledgeAllAlerts(req, res);
      expect(mockMarketAlertService.acknowledgeAllAlerts).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockMarketAlertService.acknowledgeAllAlerts.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await acknowledgeAllAlerts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAlertStats', () => {
    it('should return stats', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getAlertStats(req, res);
      expect(mockMarketAlertService.getAlertStats).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockMarketAlertService.getAlertStats.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getAlertStats(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getUnreadCount(req, res);
      expect(mockMarketAlertService.getUnacknowledgedCount).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockMarketAlertService.getUnacknowledgedCount.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getUnreadCount(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
