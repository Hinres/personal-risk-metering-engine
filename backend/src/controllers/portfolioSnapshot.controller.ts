/**
 * [PRME-v1.3-PA-001] 历史对比
 * 文件: portfolioSnapshot.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { PortfolioSnapshotService } from '../services/portfolioSnapshot.service';
import { successResponse, errorResponse } from '../utils/response';

export const getHistoricalComparison = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const period = (req.query.period as '3m' | '6m' | '1y' | '2y') || '1y';
    const result = await PortfolioSnapshotService.getHistoricalComparison(id, userId, period);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const createPortfolioSnapshot = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioSnapshotService.createSnapshot(id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
