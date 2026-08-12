/**
 * [PRME-INFRA-006] 基础设施
 * 文件: help.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import {
  getHelpList, getHelpByTopic, searchHelp,
  createHelp, updateHelp, deleteHelp,
} from '../controllers/help.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

// 公开查询（帮助内容不需要登录，但首次风险提示页需要）
router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getHelpList);
router.get('/search', authMiddleware, riskAcknowledgmentMiddleware, searchHelp);
router.get('/:topic', authMiddleware, riskAcknowledgmentMiddleware, getHelpByTopic);

// 管理后台（需要管理员权限）
router.post('/', authMiddleware, adminMiddleware, createHelp);
router.put('/:id', authMiddleware, adminMiddleware, updateHelp);
router.delete('/:id', authMiddleware, adminMiddleware, deleteHelp);

export default router;
