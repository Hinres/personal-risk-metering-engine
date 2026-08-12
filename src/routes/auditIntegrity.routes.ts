/**
 * [PRME-INFRA-002] 审计日志完整性校验路由
 * 文件: auditIntegrity.routes.ts
 * 需求描述: 等保二级-安全审计控制点优化：审计日志完整性校验
 * 最后更新: 2026-07-07
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { verifyIntegrity, getIntegrityStats } from '../controllers/auditIntegrity.controller';

const router = Router();

// 审计日志完整性校验（管理员/审计员权限）
router.get('/integrity/verify', authMiddleware, adminMiddleware, verifyIntegrity);
router.get('/integrity/stats', authMiddleware, adminMiddleware, getIntegrityStats);

export default router;
