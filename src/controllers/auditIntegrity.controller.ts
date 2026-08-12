/**
 * [PRME-INFRA-002] 审计日志完整性校验控制器
 * 文件: auditIntegrity.controller.ts
 * 需求描述: 等保二级-安全审计控制点优化：审计日志完整性校验
 * 最后更新: 2026-07-07
 */
import { Request, Response } from 'express';
import { AuditLogIntegrityService } from '../services/auditLogIntegrity.service';
import { successResponse, errorResponse } from '../utils/response';

/**
 * GET /api/v1/audit-logs/integrity/verify
 * 验证审计日志哈希链完整性
 */
export const verifyIntegrity = async (req: any, res: Response) => {
  try {
    const result = await AuditLogIntegrityService.verifyChain();
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/audit-logs/integrity/stats
 * 获取完整性校验统计
 */
export const getIntegrityStats = async (req: any, res: Response) => {
  try {
    const result = await AuditLogIntegrityService.getStats();
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
