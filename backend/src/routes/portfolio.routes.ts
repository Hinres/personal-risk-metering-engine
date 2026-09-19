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
} from '../controllers/portfolio.controller';
import { runAttribution, getAttributionHistory } from '../controllers/attribution.controller';
import { getHistoricalComparison } from '../controllers/portfolioSnapshot.controller';
import { createStopLossSuggestions, getStopLossSuggestions } from '../controllers/stopLoss.controller';
import { importHoldings } from '../controllers/holdingImport.controller';
import { createPortfolioFromTemplate } from '../controllers/portfolioTemplate.controller';
import { getPortfolioOptimization } from '../controllers/portfolioOptimization.controller';
import { getHoldings, addHolding, updateHolding, deleteHolding } from '../controllers/holding.controller';
import { getHedgingAdvice } from '../controllers/hedging.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware, optimizationConsentMiddleware } from '../middleware/riskAcknowledgment.middleware';

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

// Brinson 归因分析 (v1.3)
router.post('/:id/attribution', authMiddleware, riskAcknowledgmentMiddleware, runAttribution);
router.get('/:id/attribution/history', authMiddleware, riskAcknowledgmentMiddleware, getAttributionHistory);

// 止损建议
router.post('/:portfolio_id/stop-loss-suggestions', authMiddleware, riskAcknowledgmentMiddleware, createStopLossSuggestions);
router.get('/:portfolio_id/stop-loss-suggestions', authMiddleware, riskAcknowledgmentMiddleware, getStopLossSuggestions);

// 历史对比 (v1.3)
router.get('/:id/historical-comparison', authMiddleware, riskAcknowledgmentMiddleware, getHistoricalComparison);

// 优化建议 (v1.3)
router.get('/:id/optimize', authMiddleware, riskAcknowledgmentMiddleware, optimizationConsentMiddleware, getPortfolioOptimization);

// 持仓批量导入
router.post('/:portfolio_id/holdings/import', authMiddleware, riskAcknowledgmentMiddleware, importHoldings);

// 模板化投资组合
router.post('/from-template', authMiddleware, riskAcknowledgmentMiddleware, createPortfolioFromTemplate);

// @deprecated 兼容路由：历史对比接口，计划 v1.4 移除
router.get('/:id/history', authMiddleware, riskAcknowledgmentMiddleware, getHistoricalComparison);

// @deprecated 兼容路由：独立相关性矩阵接口，计划 v1.4 移除
router.get('/:id/correlation', authMiddleware, riskAcknowledgmentMiddleware, getPortfolioStructure);

// @deprecated 兼容路由：文档路径 /portfolios/{id}/attribution（GET），计划 v1.4 移除
router.get('/:id/attribution', authMiddleware, riskAcknowledgmentMiddleware, runAttribution);

// @deprecated 兼容路由：文档路径 /portfolios/{id}/holdings，计划 v1.4 移除，请使用 /holdings/portfolio/{id}
router.get('/:portfolioId/holdings', authMiddleware, riskAcknowledgmentMiddleware, getHoldings);
router.post('/:portfolioId/holdings', authMiddleware, riskAcknowledgmentMiddleware, addHolding);
router.put('/:portfolioId/holdings/:id', authMiddleware, riskAcknowledgmentMiddleware, updateHolding);
router.delete('/:portfolioId/holdings/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteHolding);

// V2-06：风险对冲建议（RM-003 方案 A）
router.post('/:id/hedging-advice', authMiddleware, riskAcknowledgmentMiddleware, getHedgingAdvice);

export default router;
