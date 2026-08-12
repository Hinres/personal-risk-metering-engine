/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: audit.routes.ts
 * 需求描述: 审计日志查询路由（P4 等保-安全审计控制点）
 * 最后更新: 2026-07-02
 */
import { Router } from 'express';
import { getAuditLogs, getAuditSummary } from '../controllers/audit.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

// 审计日志查询（等保要求：保留3年，不可篡改，支持查询）
router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getAuditLogs);
router.get('/summary', authMiddleware, riskAcknowledgmentMiddleware, getAuditSummary);

export default router;
