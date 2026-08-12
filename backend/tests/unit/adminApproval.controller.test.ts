/**
 * [PRME-INFRA-002-UT] adminApproval.controller 单元测试
 * 测试范围: createRequest, approveRequest, rejectRequest, getList, getById
 * 最后更新: 2026-06-24
 */
import * as adminApprovalController from '../../src/controllers/adminApproval.controller';
import { AdminApprovalService } from '../../src/services/adminApproval.service';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

jest.mock('../../src/services/adminApproval.service');
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

describe('adminApproval.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create approval request successfully', async () => {
      const req = mockReq({
        action: 'user_delete',
        resource_type: 'user',
        resource_id: 'u2',
        reason: 'test reason',
      });
      const res = mockRes();
      const mockResult = { request_id: 'r1', status: 'pending' };
      (AdminApprovalService.createRequest as jest.Mock).mockResolvedValue(mockResult);

      await adminApprovalController.createRequest(req as any, res);

      expect(AdminApprovalService.createRequest).toHaveBeenCalledWith({
        requesterId: 'u1',
        action: 'user_delete',
        resourceType: 'user',
        resourceId: 'u2',
        beforeValue: undefined,
        afterValue: undefined,
        reason: 'test reason',
      });
      expect(successResponse).toHaveBeenCalledWith(res, mockResult, 'Approval request created');
    });

    it('should return 400 when action is missing', async () => {
      const req = mockReq({ resource_type: 'user' });
      const res = mockRes();

      await adminApprovalController.createRequest(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'action is required', 400);
      expect(AdminApprovalService.createRequest).not.toHaveBeenCalled();
    });

    it('should return 400 on service error', async () => {
      const req = mockReq({ action: 'user_delete' });
      const res = mockRes();
      (AdminApprovalService.createRequest as jest.Mock).mockRejectedValue(new Error('Requester not found'));

      await adminApprovalController.createRequest(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Requester not found', 400);
    });
  });

  describe('approveRequest', () => {
    it('should approve request successfully', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      const mockResult = { request_id: 'r1', status: 'approved' };
      (AdminApprovalService.approve as jest.Mock).mockResolvedValue(mockResult);

      await adminApprovalController.approveRequest(req as any, res);

      expect(AdminApprovalService.approve).toHaveBeenCalledWith('r1', 'u1');
      expect(successResponse).toHaveBeenCalledWith(res, mockResult, 'Request approved');
    });

    it('should return 400 on service error', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (AdminApprovalService.approve as jest.Mock).mockRejectedValue(new Error('Approval request not found'));

      await adminApprovalController.approveRequest(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Approval request not found', 400);
    });
  });

  describe('rejectRequest', () => {
    it('should reject request successfully', async () => {
      const req = mockReq({ reason: 'invalid request' }, { id: 'r1' });
      const res = mockRes();
      const mockResult = { request_id: 'r1', status: 'rejected' };
      (AdminApprovalService.reject as jest.Mock).mockResolvedValue(mockResult);

      await adminApprovalController.rejectRequest(req as any, res);

      expect(AdminApprovalService.reject).toHaveBeenCalledWith('r1', 'u1', 'invalid request');
      expect(successResponse).toHaveBeenCalledWith(res, mockResult, 'Request rejected');
    });

    it('should return 400 when rejection reason is missing', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();

      await adminApprovalController.rejectRequest(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'rejection reason is required', 400);
      expect(AdminApprovalService.reject).not.toHaveBeenCalled();
    });

    it('should return 400 on service error', async () => {
      const req = mockReq({ reason: 'invalid' }, { id: 'r1' });
      const res = mockRes();
      (AdminApprovalService.reject as jest.Mock).mockRejectedValue(new Error('Request already approved'));

      await adminApprovalController.rejectRequest(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Request already approved', 400);
    });
  });

  describe('getList', () => {
    it('should return paginated approval list', async () => {
      const req = mockReq({}, {}, { status: 'pending', action: 'user_delete', page: '1', limit: '20' });
      const res = mockRes();
      const mockResult = {
        items: [{ request_id: 'r1' }],
        total: 1,
        page: 1,
        limit: 20,
      };
      (AdminApprovalService.getList as jest.Mock).mockResolvedValue(mockResult);

      await adminApprovalController.getList(req as any, res);

      expect(AdminApprovalService.getList).toHaveBeenCalledWith({
        status: 'pending',
        action: 'user_delete',
        page: 1,
        limit: 20,
      });
      expect(paginatedResponse).toHaveBeenCalledWith(res, mockResult.items, mockResult.total, mockResult.page, mockResult.limit);
    });

    it('should return 500 on service error', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (AdminApprovalService.getList as jest.Mock).mockRejectedValue(new Error('DB error'));

      await adminApprovalController.getList(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('getById', () => {
    it('should return approval request by id', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      const mockResult = { request_id: 'r1', status: 'pending' };
      (AdminApprovalService.getById as jest.Mock).mockResolvedValue(mockResult);

      await adminApprovalController.getById(req as any, res);

      expect(AdminApprovalService.getById).toHaveBeenCalledWith('r1');
      expect(successResponse).toHaveBeenCalledWith(res, mockResult);
    });

    it('should return 404 when request not found', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (AdminApprovalService.getById as jest.Mock).mockResolvedValue(null);

      await adminApprovalController.getById(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Request not found', 404);
    });

    it('should return 500 on service error', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (AdminApprovalService.getById as jest.Mock).mockRejectedValue(new Error('DB error'));

      await adminApprovalController.getById(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });
});
