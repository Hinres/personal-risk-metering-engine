/**
 * [PRME-RM-001] 实时风险监控
 * 文件: riskMonitoring.job.ts
 * 需求描述: 实时风险监控功能实现
 * 最后更新: 2026-06-11
 */
import cron, { ScheduledTask } from 'node-cron';
import { MonitorService } from '../services/monitor.service';
import logger from '../utils/logger';

export function scheduleRiskMonitoring(): ReturnType<typeof cron.schedule> {
  // M-08: 高频调度（每30秒），实际检查频率由 MonitorConfig.check_interval_seconds 控制
  return cron.schedule('*/30 * * * * *', async () => {
    logger.debug('Running risk monitoring checks');
    try {
      await MonitorService.checkAllMonitors();
      logger.debug('Risk monitoring checks completed');
    } catch (error: any) {
      logger.error('Risk monitoring failed', { error: error.message });
    }
  });
}
