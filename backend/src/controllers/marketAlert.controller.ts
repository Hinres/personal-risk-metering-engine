/**
 * [PRME-RM-002] 风险预警系统 — 市场预警用户级确认控制器
 * 文件: marketAlert.controller.ts
 * 需求描述: P1-3 市场波动预警用户级确认 API
 * 最后更新: 2026-07-07
 */
import { Request, Response } from 'express';
import { MarketAlertService } from '../services/marketAlert.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

/**
 * GET /api/v1/market-alerts
 * 获取用户市场预警列表（含确认状态）
 */
export const getMyAlerts = async (req: any, res: Response) => {
  try {
    const { acknowledged, days, page, limit } = req.query;
    const options: any = {};

    if (acknowledged !== undefined) {
      options.acknowledged = acknowledged === 'true' ? true : acknowledged === 'false' ? false : null;
    }
    if (days) options.days = parseInt(days);
    if (page) options.page = parseInt(page);
    if (limit) options.limit = parseInt(limit);

    const result = await MarketAlertService.getUserAlerts(req.user.user_id, options);
    return paginatedResponse(res, result.alerts, result.total, options.page || 1, options.limit || 20);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * POST /api/v1/market-alerts/:id/acknowledge
 * 确认单个市场预警
 */
export const acknowledgeAlert = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Alert ID is required', 400);
    }
    const result = await MarketAlertService.acknowledgeAlert(req.user.user_id, id);
    return successResponse(res, result, 'Alert acknowledged');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * POST /api/v1/market-alerts/acknowledge-all
 * 批量确认所有未确认预警
 */
export const acknowledgeAllAlerts = async (req: any, res: Response) => {
  try {
    const result = await MarketAlertService.acknowledgeAllAlerts(req.user.user_id);
    return successResponse(res, result, 'All alerts acknowledged');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/market-alerts/stats
 * 获取用户市场预警统计
 */
export const getAlertStats = async (req: any, res: Response) => {
  try {
    const result = await MarketAlertService.getAlertStats(req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/market-alerts/unread-count
 * 获取未确认预警数量（用于前端徽章/小红点）
 */
export const getUnreadCount = async (req: any, res: Response) => {
  try {
    const count = await MarketAlertService.getUnacknowledgedCount(req.user.user_id);
    return successResponse(res, { unread_count: count });
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
