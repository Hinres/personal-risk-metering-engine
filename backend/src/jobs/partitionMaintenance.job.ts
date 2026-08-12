/**
 * [PRME-INFRA-002] 分区表维护定时任务
 * 文件: partitionMaintenance.job.ts
 * 需求描述: 自动创建新分区、归档/删除过期分区
 * 最后更新: 2026-06-19
 */

import cron from 'node-cron';
import { PartitionService } from '../services/partition.service';
import logger from '../utils/logger';

let isRunning = false;

/**
 * 执行分区维护
 * - 创建当前月和下月分区
 * - 归档/删除过期分区
 */
export async function runPartitionMaintenance(): Promise<void> {
  if (isRunning) {
    logger.warn('[PartitionMaintenance] Previous job still running, skipping');
    return;
  }

  isRunning = true;
  try {
    logger.info('[PartitionMaintenance] Starting partition maintenance...');
    const result = await PartitionService.maintainPartitions();

    if (result.created.length > 0) {
      logger.info(`[PartitionMaintenance] Created partitions: ${result.created.join(', ')}`);
    }
    if (result.archived.length > 0) {
      logger.info(`[PartitionMaintenance] Archived partitions: ${result.archived.join(', ')}`);
    }
    if (result.dropped.length > 0) {
      logger.info(`[PartitionMaintenance] Dropped partitions: ${result.dropped.join(', ')}`);
    }
    if (
      result.created.length === 0 &&
      result.archived.length === 0 &&
      result.dropped.length === 0
    ) {
      logger.info('[PartitionMaintenance] No changes needed');
    }
  } catch (error: any) {
    logger.error('[PartitionMaintenance] Failed', { error: error.message });
  } finally {
    isRunning = false;
  }
}

/**
 * 初始化分区维护定时任务
 * 每月 1 日 03:00 执行
 */
export function schedulePartitionMaintenance(): ReturnType<typeof cron.schedule> {
  if (process.env.DISABLE_CRON === 'true') {
    logger.info('[PartitionMaintenance] Cron disabled');
    // Return a dummy task that does nothing
    return { stop: () => {}, destroy: () => {} } as any;
  }

  // 每月 1 日 03:00 执行
  const task = cron.schedule('0 3 1 * *', async () => {
    await runPartitionMaintenance();
  });

  logger.info('[PartitionMaintenance] Scheduled: 0 3 1 * * (monthly at 03:00)');
  return task;
}
