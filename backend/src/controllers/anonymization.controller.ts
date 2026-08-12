/**
 * [PRME-INFRA-002] 审计与合规 — 数据匿名化控制器
 * 文件: anonymization.controller.ts
 * 需求描述: 管理员触发数据匿名化流水线
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 数据匿名化
 * 最后更新: 2026-06-14
 */
import { Response } from 'express';
import { AnonymizationService } from '../services/anonymization.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

export const runAnonymization = async (req: AuthRequest, res: Response) => {
  try {
    const { dry_run } = req.body;
    const result = await AnonymizationService.runAnonymizationPipeline(dry_run === true);
    return successResponse(res, result, dry_run ? 'Dry run completed' : 'Anonymization completed');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const history = await AnonymizationService.getHistory(parseInt(limit as string));
    return successResponse(res, history);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
