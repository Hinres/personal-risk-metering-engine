/**
 * [PRME-v1.3-RM-006] 市场波动率监控
 * 文件: marketVolatility.routes.ts
 * 最后更新: 2026-08-20
 */
import { Router } from 'express';
import { getCurrentVolatility, getVolatilityTrend } from '../controllers/marketVolatility.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/volatility', authMiddleware, riskAcknowledgmentMiddleware, getCurrentVolatility);
router.get('/volatility/trend', authMiddleware, riskAcknowledgmentMiddleware, getVolatilityTrend);

export default router;
