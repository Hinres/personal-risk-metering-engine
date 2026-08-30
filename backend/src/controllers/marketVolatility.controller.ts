/**
 * [PRME-v1.3-RM-006] 市场波动率监控
 * 文件: marketVolatility.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { MarketVolatilityService } from '../services/marketVolatility.service';
import { successResponse, errorResponse } from '../utils/response';

export const getCurrentVolatility = async (req: any, res: Response) => {
  try {
    const result = await MarketVolatilityService.getCurrentVolatility();
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getVolatilityTrend = async (req: any, res: Response) => {
  try {
    const granularity = (req.query.granularity as any) || 'daily';
    const period = Number(req.query.period) || 30;
    const result = await MarketVolatilityService.getVolatilityTrend(granularity, period);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
