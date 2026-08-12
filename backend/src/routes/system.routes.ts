/**
 * [PRME-INFRA-006] 基础设施
 * 文件: system.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getConfig, setConfig, getAllConfigs, deleteConfig } from '../controllers/system.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/configs', authMiddleware, adminMiddleware, getAllConfigs);
router.get('/configs/:key', authMiddleware, adminMiddleware, getConfig);
router.put('/configs/:key', authMiddleware, adminMiddleware, setConfig);
router.delete('/configs/:key', authMiddleware, adminMiddleware, deleteConfig);

export default router;
