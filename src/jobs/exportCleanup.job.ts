/**
 * [PRME-INFRA-002] 审计与合规 - 导出文件定时清理
 * 文件: exportCleanup.job.ts
 * 需求描述: T-28 定期清理过期导出文件和数据库记录
 * 最后更新: 2026-06-19
 */
import { AppDataSource } from '../config/database';
import { DataExportRequest } from '../models/DataExportRequest';
import { LessThan } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import logger from '../utils/logger';

const exportRepo = () => AppDataSource.getRepository(DataExportRequest);

/**
 * 清理过期导出文件和数据库记录
 * @param exportsDir 可选指定导出目录（测试用）
 * @returns 清理统计 { deletedFiles: number, deletedRecords: number, errors: number }
 */
export async function cleanupExpiredExports(exportsDirOverride?: string): Promise<{ deletedFiles: number; deletedRecords: number; errors: number }> {
  const result = { deletedFiles: 0, deletedRecords: 0, errors: 0 };

  try {
    // 1. 查询已过期的导出记录
    const expiredExports = await exportRepo().find({
      where: {
        expires_at: LessThan(new Date()),
        status: 'completed',
      },
    });

    logger.info('Export cleanup started', { expiredCount: expiredExports.length });

    for (const exportReq of expiredExports) {
      try {
        // 2. 删除物理文件
        if (exportReq.file_path && fs.existsSync(exportReq.file_path)) {
          fs.unlinkSync(exportReq.file_path);
          result.deletedFiles++;
          logger.info('Deleted expired export file', { exportId: exportReq.export_id, filePath: exportReq.file_path });
        }

        // 3. 删除数据库记录
        await exportRepo().delete({ export_id: exportReq.export_id });
        result.deletedRecords++;
      } catch (err: any) {
        result.errors++;
        logger.error('Failed to cleanup export', { exportId: exportReq.export_id, error: err.message });
      }
    }

    // 4. 清理孤立文件（数据库中无记录的文件）
    const exportsDir = exportsDirOverride || path.resolve(process.cwd(), 'uploads', 'exports');
    if (fs.existsSync(exportsDir)) {
      const files = fs.readdirSync(exportsDir);
      const existingExportIds = new Set(
        (await exportRepo().find({ select: ['export_id'] })).map(e => e.export_id)
      );

      for (const file of files) {
        // 文件名格式: {export_id}_export.json
        const match = file.match(/^([a-f0-9-]{36})_export\.json$/);
        if (match) {
          const exportId = match[1];
          if (!existingExportIds.has(exportId)) {
            try {
              fs.unlinkSync(path.join(exportsDir, file));
              result.deletedFiles++;
              logger.info('Deleted orphaned export file', { file });
            } catch (err: any) {
              result.errors++;
              logger.error('Failed to delete orphaned file', { file, error: err.message });
            }
          }
        }
      }
    }

    logger.info('Export cleanup completed', {
      deletedFiles: result.deletedFiles,
      deletedRecords: result.deletedRecords,
      errors: result.errors,
    });

    return result;
  } catch (error: any) {
    logger.error('Export cleanup failed', { error: error.message });
    throw error;
  }
}

/**
 * 调度导出清理定时任务
 * 默认每天凌晨 2:00 执行
 */
export function scheduleExportCleanup(): ReturnType<typeof cron.schedule> {
  const schedule = process.env.EXPORT_CLEANUP_CRON || '0 2 * * *';
  const task = cron.schedule(schedule, async () => {
    logger.info('Starting scheduled export cleanup');
    try {
      await cleanupExpiredExports();
    } catch (error: any) {
      logger.error('Scheduled export cleanup failed', { error: error.message });
    }
  }, {
    scheduled: process.env.NODE_ENV !== 'test',
    timezone: process.env.TZ || 'Asia/Shanghai',
  });

  console.log(`Export cleanup scheduled: ${schedule}`);
  return task;
}
