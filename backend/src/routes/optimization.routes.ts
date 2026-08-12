/**
 * [PRME-INFRA-006] 基础设施
 * 文件: optimization.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { optimizePortfolio, getOptimizationMethods } from '../controllers/optimization.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import { optimizationConsentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/methods', authMiddleware, riskAcknowledgmentMiddleware, getOptimizationMethods);
router.post('/portfolio', authMiddleware, riskAcknowledgmentMiddleware, optimizationConsentMiddleware, optimizePortfolio);

// @deprecated 兼容路由：SIT-OPT-003 路径 /optimization/suggestions，计划 v1.4 移除，请使用 POST /optimization/portfolio
router.post('/suggestions', authMiddleware, riskAcknowledgmentMiddleware, optimizationConsentMiddleware, optimizePortfolio);

export default router;
