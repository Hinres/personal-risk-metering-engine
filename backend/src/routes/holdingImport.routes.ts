/**
 * [PRME-v1.3-PA-004] 持仓批量导入
 * 文件: holdingImport.routes.ts
 * 最后更新: 2026-08-20
 */
import { Router } from 'express';
import { getImportTask } from '../controllers/holdingImport.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/:task_id', authMiddleware, riskAcknowledgmentMiddleware, getImportTask);

export default router;
