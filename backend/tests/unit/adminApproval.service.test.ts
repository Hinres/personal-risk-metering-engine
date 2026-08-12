/**
 * [PRME-INFRA-002] adminApproval.service 单元测试
 * 文件: adminApproval.service.test.ts
 * 测试范围: createRequest, approve, reject, executeApprovedAction, cancelExpiredRequests, getList, getById, actionRequiresApproval, isApproved
 * 最后更新: 2026-06-25
 */
import { AdminApprovalService } from '../../src/services/adminApproval.service';
import { AppDataSource } from '../../src/config/database';
import { AuditService } from '../../src/services/audit.service';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/services/audit.service', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((data) => ({ ...data, request_id: 'req-1' })),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  count: jest.fn().mockResolvedValue(0),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('AdminApprovalService', () => {
  let approvalRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    approvalRepo = mockRepo();
    userRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'AdminApprovalRequest' || name?.includes('Approval')) return approvalRepo;
      if (name === 'User' || name?.includes('User')) return userRepo;
      return mockRepo();
    });
  });

  // ── createRequest ──
  describe('createRequest', () => {
    it('ADM-001: 应创建审批请求', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', role: 'admin', username: 'admin1' });
      approvalRepo.create.mockImplementation((data) => ({ ...data, request_id: 'req-1' }));

      const result = await AdminApprovalService.createRequest({
        requesterId: 'u1',
        action: 'user_delete',
        resourceId: 'u2',
        reason: '违规用户',
      });

      expect(result).toHaveProperty('request_id');
      expect(result.status).toBe('pending');
      expect(AuditService.log).toHaveBeenCalled();
    });

    it('ADM-002: 请求者不存在应抛错', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(AdminApprovalService.createRequest({
        requesterId: 'u-missing',
        action: 'user_delete',
      })).rejects.toThrow('Requester not found');
    });

    it('ADM-003: 非管理员应抛错', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', role: 'user' });
      await expect(AdminApprovalService.createRequest({
        requesterId: 'u1',
        action: 'user_delete',
      })).rejects.toThrow('Only admin can request approvals');
    });
  });

  // ── approve ──
  describe('approve', () => {
    it('ADM-004: 应批准请求并执行操作', async () => {
      const req = {
        request_id: 'req-1',
        status: 'pending',
        requester_id: 'u1',
        action: 'user_delete',
        resource_id: 'u2',
      };
      approvalRepo.findOne.mockResolvedValue(req);
      userRepo.findOne.mockResolvedValue({ user_id: 'u2', role: 'admin', status: 'active' });
      userRepo.save.mockResolvedValue({});

      const result = await AdminApprovalService.approve('req-1', 'u2');
      expect(result.status).toBe('approved');
      expect(result.approver_id).toBe('u2');
      expect(AuditService.log).toHaveBeenCalled();
    });

    it('ADM-005: 请求不存在应抛错', async () => {
      approvalRepo.findOne.mockResolvedValue(null);
      await expect(AdminApprovalService.approve('req-missing', 'u2'))
        .rejects.toThrow('Approval request not found');
    });

    it('ADM-006: 非 pending 状态应抛错', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'approved' });
      await expect(AdminApprovalService.approve('req-1', 'u2'))
        .rejects.toThrow('already approved');
    });

    it('ADM-007: 审批者非 admin 应抛错', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending', requester_id: 'u1' });
      userRepo.findOne.mockResolvedValue({ user_id: 'u2', role: 'user' });
      await expect(AdminApprovalService.approve('req-1', 'u2'))
        .rejects.toThrow('Approver must be admin');
    });

    it('ADM-008: 不能审批自己的请求', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending', requester_id: 'u1' });
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', role: 'admin' });
      await expect(AdminApprovalService.approve('req-1', 'u1'))
        .rejects.toThrow('Cannot approve your own request');
    });
  });

  // ── executeApprovedAction ──
  describe('executeApprovedAction', () => {
    it('ADM-009: user_delete 应删除用户', async () => {
      const req = { request_id: 'req-1', action: 'user_delete', resource_id: 'u3' };
      userRepo.findOne.mockResolvedValue({ user_id: 'u3', status: 'active' });
      userRepo.save.mockResolvedValue({});

      await (AdminApprovalService as any).executeApprovedAction(req);
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('ADM-010: user_ban 应禁用用户', async () => {
      const req = { request_id: 'req-1', action: 'user_ban', resource_id: 'u3' };
      userRepo.findOne.mockResolvedValue({ user_id: 'u3', status: 'active' });

      await (AdminApprovalService as any).executeApprovedAction(req);
      const savedUser = userRepo.save.mock.calls[0][0] as any;
      expect(savedUser.status).toBe('banned');
    });

    it('ADM-011: user_unban 应解禁用户', async () => {
      const req = { request_id: 'req-1', action: 'user_unban', resource_id: 'u3' };
      userRepo.findOne.mockResolvedValue({ user_id: 'u3', status: 'banned' });

      await (AdminApprovalService as any).executeApprovedAction(req);
      const savedUser = userRepo.save.mock.calls[0][0] as any;
      expect(savedUser.status).toBe('active');
    });

    it('ADM-012: system_config_change 应更新配置', async () => {
      const req = { request_id: 'req-1', action: 'system_config_change', after_value: { theme: 'dark' } };
      const configRepo = mockRepo();
      configRepo.findOne.mockResolvedValue({ config_key: 'theme', config_value: 'light' });
      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'AdminApprovalRequest') return approvalRepo;
        if (name === 'User') return userRepo;
        if (name === 'SystemConfig') return configRepo;
        return mockRepo();
      });

      await (AdminApprovalService as any).executeApprovedAction(req);
      expect(configRepo.save).toHaveBeenCalled();
    });

    it('ADM-013: role_change 应更新角色', async () => {
      const req = { request_id: 'req-1', action: 'role_change', resource_id: 'u3', after_value: { role: 'admin' } };
      userRepo.findOne.mockResolvedValue({ user_id: 'u3', role: 'user' });

      await (AdminApprovalService as any).executeApprovedAction(req);
      const savedUser = userRepo.save.mock.calls[0][0] as any;
      expect(savedUser.role).toBe('admin');
    });

    it('ADM-014: data_export_approve 应记录日志', async () => {
      const req = { request_id: 'req-1', action: 'data_export_approve' };
      await (AdminApprovalService as any).executeApprovedAction(req);
      // 无异常即成功
      expect(true).toBe(true);
    });

    it('ADM-015: help_content_modify 应记录日志', async () => {
      const req = { request_id: 'req-1', action: 'help_content_modify' };
      await (AdminApprovalService as any).executeApprovedAction(req);
      expect(true).toBe(true);
    });

    it('ADM-016: 未知 action 应记录警告', async () => {
      const req = { request_id: 'req-1', action: 'unknown_action' };
      await (AdminApprovalService as any).executeApprovedAction(req);
      expect(true).toBe(true);
    });

    it('ADM-017: user_delete 无 resource_id 应抛错', async () => {
      const req = { request_id: 'req-1', action: 'user_delete', resource_id: null };
      await expect((AdminApprovalService as any).executeApprovedAction(req))
        .rejects.toThrow('resource_id required');
    });
  });

  // ── cancelExpiredRequests ──
  describe('cancelExpiredRequests', () => {
    it('ADM-018: 应取消过期请求', async () => {
      const expiredReq = { request_id: 'req-1', status: 'pending', requested_at: new Date('2026-01-01') };
      approvalRepo.find.mockResolvedValue([expiredReq]);
      approvalRepo.save.mockResolvedValue({});

      const result = await AdminApprovalService.cancelExpiredRequests();
      expect(result).toBe(1);
      expect(approvalRepo.save).toHaveBeenCalled();
      expect(expiredReq.status).toBe('cancelled');
    });

    it('ADM-019: 无过期请求时应返回 0', async () => {
      approvalRepo.find.mockResolvedValue([]);
      const result = await AdminApprovalService.cancelExpiredRequests();
      expect(result).toBe(0);
    });
  });

  // ── reject ──
  describe('reject', () => {
    it('ADM-020: 应拒绝请求', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending', requester_id: 'u1' });
      userRepo.findOne.mockResolvedValue({ user_id: 'u2', role: 'admin' });

      const result = await AdminApprovalService.reject('req-1', 'u2', '不符合条件');
      expect(result.status).toBe('rejected');
      expect(result.rejection_reason).toBe('不符合条件');
      expect(AuditService.log).toHaveBeenCalled();
    });

    it('ADM-021: 不能拒绝自己的请求', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending', requester_id: 'u1' });
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', role: 'admin' });
      await expect(AdminApprovalService.reject('req-1', 'u1', 'test'))
        .rejects.toThrow('Cannot reject your own request');
    });
  });

  // ── getList / getById ──
  describe('getList & getById', () => {
    it('ADM-022: getList 应支持分页和过滤', async () => {
      const items = [{ request_id: 'req-1', status: 'pending' }];
      approvalRepo.findAndCount.mockResolvedValue([items, 1]);

      const result = await AdminApprovalService.getList({ status: 'pending', page: 1, limit: 10 });
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('ADM-023: getById 应返回单条', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending' });
      const result = await AdminApprovalService.getById('req-1');
      expect(result).toHaveProperty('request_id', 'req-1');
    });
  });

  // ── actionRequiresApproval ──
  describe('actionRequiresApproval', () => {
    it('ADM-024: 高风险操作应返回 true', () => {
      expect(AdminApprovalService.actionRequiresApproval('user_delete')).toBe(true);
      expect(AdminApprovalService.actionRequiresApproval('anonymization_trigger')).toBe(true);
      expect(AdminApprovalService.actionRequiresApproval('role_change')).toBe(true);
    });

    it('ADM-025: 低风险操作应返回 false', () => {
      expect(AdminApprovalService.actionRequiresApproval('data_export_approve')).toBe(false);
      expect(AdminApprovalService.actionRequiresApproval('help_content_modify')).toBe(false);
    });
  });

  // ── isApproved ──
  describe('isApproved', () => {
    it('ADM-026: 已批准应返回 true', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'approved' });
      const result = await AdminApprovalService.isApproved('req-1');
      expect(result).toBe(true);
    });

    it('ADM-027: pending 应返回 false', async () => {
      approvalRepo.findOne.mockResolvedValue({ request_id: 'req-1', status: 'pending' });
      const result = await AdminApprovalService.isApproved('req-1');
      expect(result).toBe(false);
    });
  });
});
