/**
 * [PRME-RM-002] 风险预警系统
 * 文件: market.routes.ts
 * 需求描述: 市场波动预警路由
 * 最后更新: 2026-06-11
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { acknowledgeMarketRiskAlert, getMarketRiskAlerts } from '../controllers/market.controller';

const router = Router();

router.get('/risk-alerts', authMiddleware, getMarketRiskAlerts);
router.post('/risk-alerts/:id/acknowledge', authMiddleware, acknowledgeMarketRiskAlert);

export default router;
