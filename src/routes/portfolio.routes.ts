/**
 * [PRME-INFRA-006] 基础设施
 * 文件: portfolio.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import {
  getPortfolios, getPortfolio, createPortfolio, updatePortfolio, deletePortfolio,
  getPortfolioStructure, getPortfolioAnalysis, getPortfolioRisk, getPortfolioSuggestions,
  getHoldingLimits, createHoldingLimit, updateHoldingLimit, deleteHoldingLimit, checkHoldingLimits,
  getPortfolioAttribution, getCorrelationMatrix, getPortfolioHistory,
} from '../controllers/portfolio.controller';
import { getHoldings, addHolding, updateHolding, deleteHolding } from '../controllers/holding.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getPortfolios);
router.post('/', authMiddleware, riskAcknowledgmentMiddleware, createPortfolio);
router.get('/:id', authMiddleware, riskAcknowledgmentMiddleware, getPortfolio);
router.put('/:id', authMiddleware, riskAcknowledgmentMiddleware, updatePortfolio);
router.delete('/:id', authMiddleware, riskAcknowledgmentMiddleware, deletePortfolio);

// 组合结构分析
router.get('/:id/structure', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioStructure);

// 风险收益分析（设计文档路径：/portfolios/:id/analysis）
router.get('/:id/analysis', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioAnalysis);

// @deprecated 别名路由（兼容旧文档 /analyze），计划 v1.4 移除，请使用 /:id/analysis
router.get('/:id/analyze', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioAnalysis);

// 组合风险（设计文档路径对齐：/portfolios/:id/risk）
router.get('/:id/risk', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioRisk);

// 优化建议（设计文档路径对齐：/portfolios/:id/suggestions）
router.get('/:id/suggestions', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioSuggestions);

// 持仓限制
router.get('/:id/limits', authMiddleware, riskAcknowledgmentMiddleware, getHoldingLimits);
router.post('/:id/limits', authMiddleware, riskAcknowledgmentMiddleware, createHoldingLimit);
router.put('/:id/limits/:limitId', authMiddleware, riskAcknowledgmentMiddleware, updateHoldingLimit);
router.delete('/:id/limits/:limitId', authMiddleware, riskAcknowledgmentMiddleware, deleteHoldingLimit);
router.get('/:id/limits/check', authMiddleware, riskAcknowledgmentMiddleware, checkHoldingLimits);

// Brinson 归因分析
router.get('/:id/attribution', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioAttribution);

// @deprecated 兼容路由：独立相关性矩阵接口，计划 v1.4 移除
router.get('/:id/correlation', authMiddleware, riskAcknowledgmentMiddleware, getCorrelationMatrix);

// @deprecated 兼容路由：历史对比接口，计划 v1.4 移除
router.get('/:id/history', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioHistory);

// @deprecated 兼容路由：文档路径 /portfolios/{id}/holdings，计划 v1.4 移除，请使用 /holdings/portfolio/{id}
router.get('/:portfolioId/holdings', authMiddleware, riskAcknowledgmentMiddleware, getHoldings);
router.post('/:portfolioId/holdings', authMiddleware, riskAcknowledgmentMiddleware, addHolding);
router.put('/:portfolioId/holdings/:id', authMiddleware, riskAcknowledgmentMiddleware, updateHolding);
router.delete('/:portfolioId/holdings/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteHolding);

export default router;
