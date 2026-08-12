/**
 * [PRME-INFRA-002] 数据库备份控制器
 * 文件: databaseBackup.controller.ts
 * 需求描述: 等保二级-数据备份恢复控制点优化：备份管理
 * 最后更新: 2026-07-07
 */
import { Request, Response } from 'express';
import { performBackup, cleanupOldBackups, verifyBackup, listBackups } from '../jobs/databaseBackup.job';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * POST /api/v1/system/backup
 * 手动触发数据库备份
 */
export const triggerBackup = async (req: any, res: Response) => {
  try {
    const backup = await performBackup();
    await cleanupOldBackups();
    return successResponse(res, backup, 'Backup completed');
  } catch (error: any) {
    logger.error('Manual backup failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/system/backups
 * 列出所有备份
 */
export const getBackups = async (req: any, res: Response) => {
  try {
    const backups = await listBackups();
    return successResponse(res, backups);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * POST /api/v1/system/backups/:filename/verify
 * 验证指定备份完整性
 */
export const verifyBackupFile = async (req: any, res: Response) => {
  try {
    const { filename } = req.params;
    const result = await verifyBackup(filename);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * POST /api/v1/system/backups/cleanup
 * 手动清理过期备份
 */
export const cleanupBackups = async (req: any, res: Response) => {
  try {
    const result = await cleanupOldBackups();
    return successResponse(res, result, 'Cleanup completed');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
