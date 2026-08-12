/**
 * [PRME-INFRA-006] 基础设施
 * 文件: holding.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getHoldings, getHoldingById, addHolding, updateHolding, deleteHolding, refreshHoldingPrice, refreshPortfolioPrices } from '../controllers/holding.controller';
import { getHoldingLimits, createHoldingLimit, updateHoldingLimit, deleteHoldingLimit, checkHoldingLimits } from '../controllers/portfolio.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/portfolio/:portfolioId', authMiddleware, riskAcknowledgmentMiddleware, getHoldings);
router.post('/portfolio/:portfolioId', authMiddleware, riskAcknowledgmentMiddleware, addHolding);
router.get('/:id', authMiddleware, riskAcknowledgmentMiddleware, getHoldingById);
router.put('/:id', authMiddleware, riskAcknowledgmentMiddleware, updateHolding);
router.delete('/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteHolding);

// 刷新价格端点（UAT TASK-004）
router.post('/portfolio/:portfolioId/:holdingId/refresh-price', authMiddleware, riskAcknowledgmentMiddleware, refreshHoldingPrice);
router.post('/portfolio/:portfolioId/refresh-prices', authMiddleware, riskAcknowledgmentMiddleware, refreshPortfolioPrices);

// SIT-PORT-005 兼容路由：详细设计文档路径为 /holdings/{id}/limits
router.get('/:id/limits', authMiddleware, riskAcknowledgmentMiddleware, getHoldingLimits);
router.post('/:id/limits', authMiddleware, riskAcknowledgmentMiddleware, createHoldingLimit);
router.put('/:id/limits/:limitId', authMiddleware, riskAcknowledgmentMiddleware, updateHoldingLimit);
router.delete('/:id/limits/:limitId', authMiddleware, riskAcknowledgmentMiddleware, deleteHoldingLimit);
router.get('/:id/limits/check', authMiddleware, riskAcknowledgmentMiddleware, checkHoldingLimits);

export default router;
