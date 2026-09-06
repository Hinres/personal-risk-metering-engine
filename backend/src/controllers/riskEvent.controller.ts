/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: riskEvent.controller.ts
 * 最后更新: 2026-09-06（DEF-V13-002：acknowledge 事件不存在返回 404）
 */
import { Request, Response } from 'express';
import { RiskEventService } from '../services/riskEvent.service';
import { successResponse, errorResponse } from '../utils/response';

export const getRiskEvents = async (req: any, res: Response) => {
  try {
    const userId = req.user.user_id;
    const acknowledged = req.query.acknowledged !== undefined ? req.query.acknowledged === 'true' : undefined;
    const level = req.query.level as string | undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await RiskEventService.getUserEvents(userId, { acknowledged, level, page, pageSize });
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const acknowledgeRiskEvent = async (req: any, res: Response) => {
  try {
    const userId = req.user.user_id;
    const { event_id } = req.params;
    const result = await RiskEventService.acknowledge(event_id, userId);
    return successResponse(res, result);
  } catch (error: any) {
    // DEF-V13-002：资源不存在时返回 404，而非统一 400
    const status = error.message === 'Event not found' ? 404 : 400;
    return errorResponse(res, error.message, status);
  }
};
