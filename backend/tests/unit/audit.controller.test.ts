/**
 * [PRME-PA-001] audit.controller 单元测试
 * 测试范围: getAuditLogs, getAuditSummary
 * 最后更新: 2026-07-08
 */

const mockAuditService = {
  queryLogs: jest.fn().mockResolvedValue({
    logs: [{ log_id: 'l1' }],
    total: 1,
    page: 1,
    limit: 20,
  }),
};

jest.mock('../../src/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getAuditLogs, getAuditSummary } from '../../src/controllers/audit.controller';

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

const mockRequest = (overrides: any = {}) => ({
  user: { user_id: 'user-1' },
  query: {},
  ...overrides,
});

describe('audit.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService.queryLogs.mockResolvedValue({
      logs: [{ log_id: 'l1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  describe('getAuditLogs', () => {
    it('should query logs with default pagination', async () => {
      const req = mockRequest();
      const res = mockResponse();
      await getAuditLogs(req, res);
      expect(mockAuditService.queryLogs).toHaveBeenCalledWith(expect.objectContaining({
        page: 1, limit: 20,
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should query logs with filters', async () => {
      const req = mockRequest({ query: {
        page: '2', limit: '50', user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio',
        start_date: '2026-01-01', end_date: '2026-12-31',
      }});
      const res = mockResponse();
      await getAuditLogs(req, res);
      expect(mockAuditService.queryLogs).toHaveBeenCalledWith(expect.objectContaining({
        page: 2, limit: 50, user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio',
        start_date: '2026-01-01', end_date: '2026-12-31',
      }));
    });

    it('should handle error', async () => {
      mockAuditService.queryLogs.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getAuditLogs(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAuditSummary', () => {
    it('should return summary', async () => {
      const req = mockRequest({ query: { start_date: '2026-01-01', end_date: '2026-12-31' } });
      const res = mockResponse();
      await getAuditSummary(req, res);
      expect(mockAuditService.queryLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 1 }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockAuditService.queryLogs.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();
      await getAuditSummary(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
