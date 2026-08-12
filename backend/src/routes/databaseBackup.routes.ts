/**
 * [PRME-INFRA-002] 数据库备份路由
 * 文件: databaseBackup.routes.ts
 * 需求描述: 等保二级-数据备份恢复控制点优化：备份管理
 * 最后更新: 2026-07-07
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { triggerBackup, getBackups, verifyBackupFile, cleanupBackups } from '../controllers/databaseBackup.controller';

const router = Router();

// 备份管理（管理员权限）
router.post('/backup', authMiddleware, adminMiddleware, triggerBackup);
router.get('/backups', authMiddleware, adminMiddleware, getBackups);
router.post('/backups/:filename/verify', authMiddleware, adminMiddleware, verifyBackupFile);
router.post('/backups/cleanup', authMiddleware, adminMiddleware, cleanupBackups);

export default router;
