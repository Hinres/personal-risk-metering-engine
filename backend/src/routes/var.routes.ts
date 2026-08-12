/**
 * [PRME-INFRA-006] 基础设施
 * 文件: var.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { calculateVaR, getVaRHistory } from '../controllers/var.controller';
import { calculateToolVaR } from '../controllers/tool.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import { calcLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/calculate', authMiddleware, riskAcknowledgmentMiddleware, calcLimiter, calculateVaR);
router.get('/history', authMiddleware, riskAcknowledgmentMiddleware, getVaRHistory);

// SIT-TOOL-001 兼容路由：QA 测试脚本使用 /var/calculate-standalone 路径
// 复用 tool.controller 的独立VaR计算逻辑
router.post('/calculate-standalone', authMiddleware, riskAcknowledgmentMiddleware, calcLimiter, calculateToolVaR);

export default router;
