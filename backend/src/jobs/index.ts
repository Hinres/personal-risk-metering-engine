/**
 * [PRME-INFRA-006] 基础设施 - 定时任务调度器
 * 文件: index.ts
 * 需求描述: 所有定时任务调度入口
 * 最后更新: 2026-09-08（SIT-20260907 观察项 3：解除 cron timer 事件循环引用）
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
import { scheduleDailyPortfolioSnapshot } from './dailyPortfolioSnapshot.job';
import { scheduleRiskEventCollection } from './riskEventCollection.job';
import { scheduleFundamentalSync } from './fundamentalSync.job';
import { scheduleMarketVolatility } from './marketVolatility.job';

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
      scheduleDailyPortfolioSnapshot(),
      scheduleRiskEventCollection(),
      scheduleFundamentalSync(),
      scheduleMarketVolatility(),
    ];
    console.log('Cron jobs initialized');

    // SIT-20260907 观察项 3：node-cron 3.x 的递归 setTimeout 持有事件循环引用，
    // Jest 场景（如 graceful-shutdown 测试将 NODE_ENV 改为 development 后初始化）
    // 会导致 "worker process has failed to exit gracefully"。解除 timer 引用不影响
    // 生产环境（HTTP server 保活），也让测试进程可以自然退出。
    for (const task of scheduledTasks) {
      const timeout = (task as any)?._scheduler?.timeout;
      if (timeout && typeof timeout.unref === 'function') {
        timeout.unref();
      }
    }
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
