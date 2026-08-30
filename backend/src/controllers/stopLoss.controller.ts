/**
 * [PRME-v1.3-RM-004] 止损建议
 * 文件: stopLoss.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { StopLossService } from '../services/stopLoss.service';
import { successResponse, errorResponse } from '../utils/response';

export const createStopLossSuggestions = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.params;
    const userId = req.user.user_id;
    const result = await StopLossService.generateSuggestion(portfolio_id, userId, req.body);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getStopLossSuggestions = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.params;
    const userId = req.user.user_id;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await StopLossService.getHistory(portfolio_id, userId, page, pageSize);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
