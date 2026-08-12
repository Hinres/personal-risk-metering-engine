/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: audit.controller.ts
 * 需求描述: 审计日志查询接口（P4 等保-安全审计控制点）
 * 最后更新: 2026-07-02
 */
import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * GET /api/v1/audit-logs
 * 查询审计日志（支持分页、按操作类型/资源类型/用户/时间范围过滤）
 */
export const getAuditLogs = async (req: any, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      user_id,
      operation_type,
      resource_type,
      start_date,
      end_date,
    } = req.query;

    const result = await AuditService.queryLogs({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      user_id: user_id as string | undefined,
      operation_type: operation_type as string | undefined,
      resource_type: resource_type as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
    });

    return paginatedResponse(res, result.logs, result.total, result.page, result.limit);
  } catch (error: any) {
    logger.error('Audit logs query failed', { error: error.message, query: req.query });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/audit-logs/summary
 * 审计日志统计摘要（等保检查用）
 */
export const getAuditSummary = async (req: any, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    const summary = await AuditService.queryLogs({
      page: 1,
      limit: 1,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
    });

    return successResponse(res, {
      total_logs: summary.total,
      period: { start_date, end_date },
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Audit summary failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};
