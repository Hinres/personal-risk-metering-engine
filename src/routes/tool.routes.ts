/**
 * [PRME-INFRA-006] 基础设施
 * 文件: tool.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import {
  calculateToolVaR, getToolVaRHistory, getToolVaRHistoryDetail,
  savePreset, getPresets, deletePreset,
} from '../controllers/tool.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import { calcLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// 独立VaR计算（不保存到组合，但保存到历史记录）
router.post('/var-calc', authMiddleware, riskAcknowledgmentMiddleware, calcLimiter, calculateToolVaR);

// 计算历史
router.get('/var-history', authMiddleware, riskAcknowledgmentMiddleware, getToolVaRHistory);
router.get('/var-history/:id', authMiddleware, riskAcknowledgmentMiddleware, getToolVaRHistoryDetail);

// 参数预设
router.get('/var-presets', authMiddleware, riskAcknowledgmentMiddleware, getPresets);
router.post('/var-presets', authMiddleware, riskAcknowledgmentMiddleware, savePreset);
router.delete('/var-presets/:name', authMiddleware, riskAcknowledgmentMiddleware, deletePreset);

export default router;
