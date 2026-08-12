/**
 * [PRME-INFRA-002] 审计与合规 — 数据匿名化路由
 * 文件: anonymization.routes.ts
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 数据匿名化
 * 最后更新: 2026-06-14
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { runAnonymization, getHistory } from '../controllers/anonymization.controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.post('/', runAnonymization);
router.get('/history', getHistory);

export default router;
