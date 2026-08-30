/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: riskEvent.routes.ts
 * 最后更新: 2026-08-20
 */
import { Router } from 'express';
import { getRiskEvents, acknowledgeRiskEvent } from '../controllers/riskEvent.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getRiskEvents);
router.post('/:event_id/acknowledge', authMiddleware, riskAcknowledgmentMiddleware, acknowledgeRiskEvent);

export default router;
