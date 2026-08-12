/**
 * [PRME-INFRA-002-UT] anonymization.controller 单元测试
 * 测试范围: runAnonymization, getHistory
 * 最后更新: 2026-06-24
 */
import * as anonymizationController from '../../src/controllers/anonymization.controller';
import { AnonymizationService } from '../../src/services/anonymization.service';
import { successResponse, errorResponse } from '../../src/utils/response';

jest.mock('../../src/services/anonymization.service');
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

describe('anonymization.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runAnonymization', () => {
    it('should run anonymization pipeline successfully (dry run)', async () => {
      const req = mockReq({ dry_run: true });
      const res = mockRes();
      const mockResult = {
        logId: 'log1',
        results: [{ table: 'users', recordsProcessed: 0, fieldsAnonymized: ['username'] }],
        totalRecords: 0,
        status: 'dry_run_completed',
      };
      (AnonymizationService.runAnonymizationPipeline as jest.Mock).mockResolvedValue(mockResult);

      await anonymizationController.runAnonymization(req as any, res);

      expect(AnonymizationService.runAnonymizationPipeline).toHaveBeenCalledWith(true);
      expect(successResponse).toHaveBeenCalledWith(res, mockResult, 'Dry run completed');
    });

    it('should run anonymization pipeline successfully (full run)', async () => {
      const req = mockReq({ dry_run: false });
      const res = mockRes();
      const mockResult = {
        logId: 'log1',
        results: [{ table: 'users', recordsProcessed: 10, fieldsAnonymized: ['username'] }],
        totalRecords: 10,
        status: 'completed',
      };
      (AnonymizationService.runAnonymizationPipeline as jest.Mock).mockResolvedValue(mockResult);

      await anonymizationController.runAnonymization(req as any, res);

      expect(AnonymizationService.runAnonymizationPipeline).toHaveBeenCalledWith(false);
      expect(successResponse).toHaveBeenCalledWith(res, mockResult, 'Anonymization completed');
    });

    it('should return 500 on service error', async () => {
      const req = mockReq({ dry_run: true });
      const res = mockRes();
      (AnonymizationService.runAnonymizationPipeline as jest.Mock).mockRejectedValue(new Error('Pipeline failed'));

      await anonymizationController.runAnonymization(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Pipeline failed', 500);
    });
  });

  describe('getHistory', () => {
    it('should return anonymization history', async () => {
      const req = mockReq({}, {}, { limit: '30' });
      const res = mockRes();
      const mockHistory = [{ log_id: 'log1', status: 'completed' }];
      (AnonymizationService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

      await anonymizationController.getHistory(req as any, res);

      expect(AnonymizationService.getHistory).toHaveBeenCalledWith(30);
      expect(successResponse).toHaveBeenCalledWith(res, mockHistory);
    });

    it('should return history with default limit', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      const mockHistory = [{ log_id: 'log1' }];
      (AnonymizationService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

      await anonymizationController.getHistory(req as any, res);

      expect(AnonymizationService.getHistory).toHaveBeenCalledWith(50);
      expect(successResponse).toHaveBeenCalledWith(res, mockHistory);
    });

    it('should return 500 on service error', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (AnonymizationService.getHistory as jest.Mock).mockRejectedValue(new Error('DB error'));

      await anonymizationController.getHistory(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });
});
