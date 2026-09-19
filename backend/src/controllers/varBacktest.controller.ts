/**
 * [PRME-v1.3.2-V2-04] VaR 回测控制器
 * 文件: varBacktest.controller.ts
 * 需求描述: GET /var/backtest?portfolio_id=&window_days=（属主校验，window 90/180/365）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §7.5
 * 日期: 2026-09-19
 */
import { Request, Response } from 'express';
import { VarBacktestService } from '../services/varBacktest.service';
import { successResponse, errorResponse } from '../utils/response';

export const runVarBacktest = async (req: any, res: Response) => {
  try {
    const portfolioId = req.query.portfolio_id as string;
    if (!portfolioId || typeof portfolioId !== 'string') {
      return errorResponse(res, 'portfolio_id is required', 400);
    }
    const windowDays = req.query.window_days !== undefined
      ? parseInt(req.query.window_days as string, 10)
      : 180;
    if (!Number.isInteger(windowDays)) {
      return errorResponse(res, 'window_days 必须是 90/180/365 之一', 400);
    }
    const result = await VarBacktestService.runBacktest(portfolioId, req.user.user_id, windowDays);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
};
