/**
 * [PRME-INFRA-006] 基础设施 - 定时任务调度器
 * 文件: index.ts
 * 需求描述: 所有定时任务调度入口
 * 最后更新: 2026-06-09
 */
import cron from 'node-cron';
import { scheduleMarketDataSync } from './marketDataSync.job';
import { scheduleVaRCalculation } from './varCalculation.job';
import { scheduleRiskMonitoring } from './riskMonitoring.job';
import { scheduleReportGeneration } from './reportGeneration.job';
import { scheduleMarketFluctuationCheck } from './marketFluctuation.job';
import { schedulePartitionMaintenance } from './partitionMaintenance.job';
import { scheduleDatabaseBackup } from './databaseBackup.job';

import { scheduleExportCleanup } from './exportCleanup.job';

let scheduledTasks: ReturnType<typeof cron.schedule>[] = [];

export function initializeJobs(): ReturnType<typeof cron.schedule>[] {
  if (process.env.NODE_ENV !== 'test') {
    scheduledTasks = [
      scheduleMarketDataSync(),
      scheduleVaRCalculation(),
      scheduleRiskMonitoring(),
      scheduleReportGeneration(),
      scheduleMarketFluctuationCheck(),
      schedulePartitionMaintenance(),
      scheduleDatabaseBackup(),
      scheduleExportCleanup(),
    ];
    console.log('Cron jobs initialized');
  }
  return scheduledTasks;
}

export function stopJobs(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
  console.log('Cron jobs stopped');
}
