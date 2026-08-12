/**
 * [PRME-INFRA-006] 基础设施
 * 文件: valuation.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import {
  searchStocks,
  getStockDetail,
  calculateValuation,
  getValuationHistory,
  getValuationMethods,
} from '../controllers/valuation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

// 股票搜索（公开或需认证根据需求）
router.get('/stocks/search', authMiddleware, riskAcknowledgmentMiddleware, searchStocks);
router.get('/stocks/:symbol', authMiddleware, riskAcknowledgmentMiddleware, getStockDetail);

// 估值计算
router.get('/methods', authMiddleware, riskAcknowledgmentMiddleware, getValuationMethods);
router.post('/calculate', authMiddleware, riskAcknowledgmentMiddleware, calculateValuation);
router.get('/history', authMiddleware, riskAcknowledgmentMiddleware, getValuationHistory);

export default router;
