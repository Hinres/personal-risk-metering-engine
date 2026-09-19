/**
 * [PRME-v1.3.2-V2-06] 风险对冲建议控制器
 * 文件: hedging.controller.ts
 * 需求描述: POST /portfolios/:id/hedging-advice（即时计算，不落库）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §6.3
 * 日期: 2026-09-19
 */
import { Request, Response } from 'express';
import { HedgingService } from '../services/hedging.service';
import { successResponse, errorResponse } from '../utils/response';

export const getHedgingAdvice = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Portfolio ID is required', 400);
    }
    const result = await HedgingService.getAdvice(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
};
