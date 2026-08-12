/**
 * [PRME-INFRA-002] 审计与合规 — 管理员操作审批服务
 * 文件: adminApproval.service.ts
 * 需求描述: 管理员关键操作需审批流程（如数据导出、用户删除、系统配置变更）
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 管理员操作审批
 * 最后更新: 2026-06-14
 */
import { AppDataSource } from '../config/database';
import { AdminApprovalRequest } from '../models/AdminApprovalRequest';
import { User } from '../models/User';
import { AuditService } from './audit.service';
import logger from '../utils/logger';

const approvalRepo = () => AppDataSource.getRepository(AdminApprovalRequest);
const userRepo = () => AppDataSource.getRepository(User);

export type AdminActionType =
  | 'user_delete'
  | 'user_ban'
  | 'user_unban'
  | 'data_export_approve'
  | 'system_config_change'
  | 'help_content_modify'
  | 'anonymization_trigger'
  | 'role_change';

interface CreateApprovalInput {
  requesterId: string;
  action: AdminActionType;
  resourceType?: string;
  resourceId?: string;
  beforeValue?: Record<string, any>;
  afterValue?: Record<string, any>;
  reason?: string;
}

export class AdminApprovalService {
  /**
   * 创建审批请求
   */
  static async createRequest(input: CreateApprovalInput) {
    const { requesterId, action, resourceType, resourceId, beforeValue, afterValue, reason } = input;

    const requester = await userRepo().findOne({ where: { user_id: requesterId } });
    if (!requester) throw new Error('Requester not found');
    if (requester.role !== 'admin') throw new Error('Only admin can request approvals');

    const req = approvalRepo().create({
      requester_id: requesterId,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      before_value: beforeValue || null,
      after_value: afterValue || null,
      status: 'pending',
    });

    await approvalRepo().save(req);

    await AuditService.log('CREATE', 'admin_approval_requests', req.request_id, {
      action,
      resourceType,
      resourceId,
      reason,
      requesterId,
    }, { userId: requesterId });

    logger.info('Admin approval request created', { requestId: req.request_id, action });
    return req;
  }

  /**
   * T-24: 审批通过 + 自动执行操作
   */
  static async approve(requestId: string, approverId: string) {
    const req = await approvalRepo().findOne({ where: { request_id: requestId } });
    if (!req) throw new Error('Approval request not found');
    if (req.status !== 'pending') throw new Error(`Request already ${req.status}`);

    const approver = await userRepo().findOne({ where: { user_id: approverId } });
    if (!approver || approver.role !== 'admin') throw new Error('Approver must be admin');
    if (req.requester_id === approverId) throw new Error('Cannot approve your own request');

    req.approver_id = approverId;
    req.status = 'approved';
    req.approved_at = new Date();
    await approvalRepo().save(req);

    await AuditService.log('UPDATE', 'admin_approval_requests', req.request_id, {
      status: 'approved',
      approverId,
      action: req.action,
    }, { userId: approverId });

    logger.info('Admin approval request approved', { requestId: requestId, approverId });

    // 自动执行审批后的操作
    try {
      await this.executeApprovedAction(req);
    } catch (execErr: any) {
      logger.error('Auto-execution failed after approval', { requestId, error: execErr.message });
      // 执行失败不改变审批状态，但记录错误
      req.execution_error = execErr.message;
      await approvalRepo().save(req);
    }

    return req;
  }

  /**
   * T-24: 根据审批类型自动执行操作
   */
  private static async executeApprovedAction(req: AdminApprovalRequest): Promise<void> {
    const { action, resource_id, after_value } = req;
    logger.info('Executing approved action', { requestId: req.request_id, action, resourceId: resource_id });

    switch (action) {
      case 'user_delete': {
        if (!resource_id) throw new Error('resource_id required for user_delete');
        const user = await userRepo().findOne({ where: { user_id: resource_id } });
        if (user) {
          user.status = 'deleted';
          user.deleted_at = new Date();
          await userRepo().save(user);
          logger.info('User deleted after approval', { userId: resource_id });
        }
        break;
      }

      case 'user_ban': {
        if (!resource_id) throw new Error('resource_id required for user_ban');
        const user = await userRepo().findOne({ where: { user_id: resource_id } });
        if (user) {
          user.status = 'banned';
          await userRepo().save(user);
          logger.info('User banned after approval', { userId: resource_id });
        }
        break;
      }

      case 'user_unban': {
        if (!resource_id) throw new Error('resource_id required for user_unban');
        const user = await userRepo().findOne({ where: { user_id: resource_id } });
        if (user) {
          user.status = 'active';
          await userRepo().save(user);
          logger.info('User unbanned after approval', { userId: resource_id });
        }
        break;
      }

      case 'system_config_change': {
        if (!after_value) throw new Error('after_value required for system_config_change');
        const configRepo = AppDataSource.getRepository('SystemConfig');
        const configs = after_value as Record<string, string>;
        for (const [key, value] of Object.entries(configs)) {
          const existing = await configRepo.findOne({ where: { config_key: key } });
          if (existing) {
            (existing as any).config_value = value;
            await configRepo.save(existing);
          } else {
            await configRepo.save({ config_key: key, config_value: value });
          }
        }
        logger.info('System config updated after approval', { configs });
        break;
      }

      case 'role_change': {
        if (!resource_id || !after_value?.role) throw new Error('resource_id and after_value.role required for role_change');
        const user = await userRepo().findOne({ where: { user_id: resource_id } });
        if (user) {
          user.role = after_value.role;
          await userRepo().save(user);
          logger.info('User role changed after approval', { userId: resource_id, newRole: after_value.role });
        }
        break;
      }

      case 'anonymization_trigger': {
        // 匿名化操作通常较重，异步执行
        const { AnonymizationService } = await import('./anonymization.service');
        await AnonymizationService.runAnonymizationPipeline();
        logger.info('Anonymization triggered after approval', { requestId: req.request_id });
        break;
      }

      case 'data_export_approve': {
        // 数据导出审批已自动完成（无需额外操作，导出链接已生成）
        logger.info('Data export approved', { requestId: req.request_id });
        break;
      }

      case 'help_content_modify': {
        // 帮助内容修改需具体实现，暂记录日志
        logger.info('Help content modification approved', { requestId: req.request_id });
        break;
      }

      default:
        logger.warn('Unknown action type for auto-execution', { action });
    }
  }

  /**
   * T-24: 审批超时自动取消（7天未处理）
   */
  static async cancelExpiredRequests(): Promise<number> {
    const deadline = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天前
    const expired = await approvalRepo().find({
      where: {
        status: 'pending',
        requested_at: { $lt: deadline } as any,
      },
    });

    let cancelled = 0;
    for (const req of expired) {
      req.status = 'cancelled';
      req.cancelled_at = new Date();
      await approvalRepo().save(req);
      cancelled++;
      logger.info('Admin approval request auto-cancelled (expired)', { requestId: req.request_id });
    }

    return cancelled;
  }

  /**
   * 审批拒绝
   */
  static async reject(requestId: string, approverId: string, rejectionReason: string) {
    const req = await approvalRepo().findOne({ where: { request_id: requestId } });
    if (!req) throw new Error('Approval request not found');
    if (req.status !== 'pending') throw new Error(`Request already ${req.status}`);

    const approver = await userRepo().findOne({ where: { user_id: approverId } });
    if (!approver || approver.role !== 'admin') throw new Error('Approver must be admin');
    if (req.requester_id === approverId) throw new Error('Cannot reject your own request');

    req.approver_id = approverId;
    req.status = 'rejected';
    req.rejected_at = new Date();
    req.rejection_reason = rejectionReason;
    await approvalRepo().save(req);

    await AuditService.log('UPDATE', 'admin_approval_requests', req.request_id, {
      status: 'rejected',
      approverId,
      rejectionReason,
      action: req.action,
    }, { userId: approverId });

    logger.info('Admin approval request rejected', { requestId, approverId, reason: rejectionReason });
    return req;
  }

  /**
   * 获取审批请求列表
   */
  static async getList(filters?: {
    status?: 'pending' | 'approved' | 'rejected';
    requesterId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, requesterId, action, page = 1, limit = 20 } = filters || {};

    const where: any = {};
    if (status) where.status = status;
    if (requesterId) where.requester_id = requesterId;
    if (action) where.action = action;

    const [items, total] = await approvalRepo().findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { requested_at: 'DESC' },
      relations: ['requester', 'approver'],
    });

    return { items, total, page, limit };
  }

  /**
   * 获取单条审批请求
   */
  static async getById(requestId: string) {
    return approvalRepo().findOne({
      where: { request_id: requestId },
      relations: ['requester', 'approver'],
    });
  }

  /**
   * 检查某操作是否需要审批（简化策略：高风险操作需要）
   */
  static actionRequiresApproval(action: AdminActionType): boolean {
    const highRiskActions: AdminActionType[] = [
      'user_delete',
      'user_ban',
      'anonymization_trigger',
      'role_change',
      'system_config_change',
    ];
    return highRiskActions.includes(action);
  }

  /**
   * 检查某操作是否已获批准
   */
  static async isApproved(requestId: string): Promise<boolean> {
    const req = await approvalRepo().findOne({ where: { request_id: requestId } });
    return req?.status === 'approved';
  }
}

export default AdminApprovalService;
