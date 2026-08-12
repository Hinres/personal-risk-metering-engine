/**
 * [PRME-RM-002] 风险预警系统 — 市场预警用户级确认路由
 * 文件: marketAlert.routes.ts
 * 需求描述: P1-3 市场波动预警用户级确认 API 路由
 * 最后更新: 2026-07-07
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import {
  getMyAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  getAlertStats,
  getUnreadCount,
} from '../controllers/marketAlert.controller';

const router = Router();

// GET /api/v1/market-alerts — 获取用户市场预警列表
router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getMyAlerts);
// GET /api/v1/market-alerts/stats — 统计信息
router.get('/stats', authMiddleware, riskAcknowledgmentMiddleware, getAlertStats);
// GET /api/v1/market-alerts/unread-count — 未确认数量（小红点）
router.get('/unread-count', authMiddleware, riskAcknowledgmentMiddleware, getUnreadCount);
// POST /api/v1/market-alerts/:id/acknowledge — 确认单个预警
router.post('/:id/acknowledge', authMiddleware, riskAcknowledgmentMiddleware, acknowledgeAlert);
// POST /api/v1/market-alerts/acknowledge-all — 批量确认所有预警
router.post('/acknowledge-all', authMiddleware, riskAcknowledgmentMiddleware, acknowledgeAllAlerts);

export default router;
