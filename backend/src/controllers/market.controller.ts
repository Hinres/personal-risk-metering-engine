/**
 * [PRME-RM-002] 风险预警系统
 * 文件: market.controller.ts
 * 需求描述: 市场波动预警用户确认接口
 * 最后更新: 2026-06-11
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { MarketRiskAlert } from '../models/MarketRiskAlert';
import { MarketRiskAlertAcknowledgment } from '../models/MarketRiskAlertAcknowledgment';
import { In } from 'typeorm';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const alertRepo = () => AppDataSource.getRepository(MarketRiskAlert);
const ackRepo = () => AppDataSource.getRepository(MarketRiskAlertAcknowledgment);

/**
 * 用户确认市场波动预警
 * POST /api/v1/market/risk-alerts/:id/acknowledge
 */
export const acknowledgeMarketRiskAlert = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const alert = await alertRepo().findOne({ where: { alert_id: id } });
    if (!alert) {
      return errorResponse(res, 'Market risk alert not found', 404);
    }

    // 检查是否已确认
    const existingAck = await ackRepo().findOne({
      where: { alert_id: id, user_id: userId },
    });
    if (existingAck) {
      return successResponse(res, { acknowledged: true, acknowledged_at: existingAck.acknowledged_at }, 'Already acknowledged');
    }

    // 创建确认记录
    const ack = ackRepo().create({
      alert_id: id,
      user_id: userId,
    });
    await ackRepo().save(ack);

    // 更新全量确认计数
    alert.acknowledged_count += 1;
    await alertRepo().save(alert);

    logger.info('Market risk alert acknowledged', { alertId: id, userId });
    return successResponse(res, { acknowledged: true, acknowledged_at: ack.acknowledged_at }, 'Acknowledged');
  } catch (error: any) {
    logger.error('Failed to acknowledge market risk alert', { error: error.message, alertId: req.params.id });
    return errorResponse(res, 'Failed to acknowledge alert', 500);
  }
};

/**
 * 获取市场波动预警列表（含当前用户确认状态）
 * GET /api/v1/market/risk-alerts
 */
export const getMarketRiskAlerts = async (req: any, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (!userId) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const [alerts, total] = await alertRepo().findAndCount({
      order: { triggered_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 查询当前用户的确认记录
    const alertIds = alerts.map(a => a.alert_id);
    const acks = await ackRepo().find({
      where: alertIds.length > 0 ? { alert_id: In(alertIds), user_id: userId } : {},
    });
    const ackSet = new Set(acks.map(a => a.alert_id));

    const results = alerts.map(a => ({
      ...a,
      is_acknowledged_by_user: ackSet.has(a.alert_id),
    }));

    return successResponse(res, { alerts: results, total, page, limit });
  } catch (error: any) {
    logger.error('Failed to fetch market risk alerts', { error: error.message });
    return errorResponse(res, 'Failed to fetch alerts', 500);
  }
};
