/**
 * [PRME-INFRA-002] 审计与合规 — 管理员审批控制器
 * 文件: adminApproval.controller.ts
 * 需求描述: 管理员审批请求的管理接口
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 管理员操作审批
 * 最后更新: 2026-06-14
 */
import { Response } from 'express';
import { AdminApprovalService } from '../services/adminApproval.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

export const createRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource_type, resource_id, before_value, after_value, reason } = req.body;
    if (!action) {
      return errorResponse(res, 'action is required', 400);
    }

    const result = await AdminApprovalService.createRequest({
      requesterId: req.user.user_id,
      action,
      resourceType: resource_type,
      resourceId: resource_id,
      beforeValue: before_value,
      afterValue: after_value,
      reason,
    });

    return successResponse(res, result, 'Approval request created');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const approveRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await AdminApprovalService.approve(id, req.user.user_id);
    return successResponse(res, result, 'Request approved');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const rejectRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      return errorResponse(res, 'rejection reason is required', 400);
    }
    const result = await AdminApprovalService.reject(id, req.user.user_id, reason);
    return successResponse(res, result, 'Request rejected');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getList = async (req: AuthRequest, res: Response) => {
  try {
    const { status, action, page = 1, limit = 20 } = req.query;
    const result = await AdminApprovalService.getList({
      status: status as any,
      action: action as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
    return paginatedResponse(res, result.items, result.total, result.page, result.limit);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getById = async (req: AuthRequest, res: Response) => {
  try {
    const result = await AdminApprovalService.getById(req.params.id);
    if (!result) return errorResponse(res, 'Request not found', 404);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
