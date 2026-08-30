/**
 * [PRME-v1.3-PA-005] 模板化投资组合
 * 文件: portfolioTemplate.routes.ts
 * 最后更新: 2026-08-20
 */
import { Router } from 'express';
import { getPortfolioTemplates, getPortfolioTemplateById } from '../controllers/portfolioTemplate.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioTemplates);
router.get('/:id', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioTemplateById);

export default router;
