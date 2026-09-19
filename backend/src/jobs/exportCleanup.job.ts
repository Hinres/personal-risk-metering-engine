/**
 * [PRME-INFRA-002] 审计与合规 - 导出文件定时清理
 * 文件: exportCleanup.job.ts
 * 需求描述: T-28 定期清理过期导出文件和数据库记录
 * 最后更新: 2026-09-16
 */
import { AppDataSource } from '../config/database';
import { DataExportRequest } from '../models/DataExportRequest';
import { StockDailyBasic } from '../models/StockDailyBasic';
import { LessThan } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import logger from '../utils/logger';

const exportRepo = () => AppDataSource.getRepository(DataExportRequest);
const dailyBasicRepo = () => AppDataSource.getRepository(StockDailyBasic);

/** 格式化为 YYYY-MM-DD（与 stock_daily_basic.trade_date 存储格式一致） */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
 * [PRME-v1.3-PA-003 §4.1] 清理 stock_daily_basic 超期快照
 * 口径：删除 trade_date 早于"当前日期往前 3 个自然年"的全部行
 * （SQL 等价：DELETE FROM stock_daily_basic WHERE trade_date < date('now', '-3 years')）
 * trade_date 上有 idx_sdb_date 索引，删除条件可走索引
 * @returns 清理统计 { deletedRows }
 */
export async function cleanupExpiredDailyBasicSnapshots(): Promise<{ deletedRows: number }> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    const cutoffStr = toDateStr(cutoff);

    logger.info('Daily basic snapshot cleanup started', { cutoff: cutoffStr });

    const deleteResult = await dailyBasicRepo().delete({
      trade_date: LessThan(cutoffStr as any),
    });
    const deletedRows = deleteResult.affected ?? 0;

    logger.info('Daily basic snapshot cleanup completed', { deletedRows });
    return { deletedRows };
  } catch (error: any) {
    logger.error('Daily basic snapshot cleanup failed', { error: error.message });
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
    // 同一凌晨 2:00 窗口，顺序清理超期基本面快照（§4.1 保留最近 3 个自然年）
    try {
      await cleanupExpiredDailyBasicSnapshots();
    } catch (error: any) {
      logger.error('Scheduled daily basic snapshot cleanup failed', { error: error.message });
    }
  }, {
    scheduled: process.env.NODE_ENV !== 'test',
    timezone: process.env.TZ || 'Asia/Shanghai',
  });

  console.log(`Export cleanup scheduled: ${schedule}`);
  return task;
}
