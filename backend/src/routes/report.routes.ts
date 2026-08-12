/**
 * [PRME-INFRA-006] 基础设施
 * 文件: report.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getReports, generateReport, getReportById, deleteReport, exportReport } from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getReports);
router.post('/', authMiddleware, riskAcknowledgmentMiddleware, generateReport);
router.get('/:id/export', authMiddleware, riskAcknowledgmentMiddleware, exportReport);
router.get('/:id', authMiddleware, riskAcknowledgmentMiddleware, getReportById);
router.delete('/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteReport);

export default router;
