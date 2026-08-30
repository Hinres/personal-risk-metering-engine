/**
 * [PRME-v1.3-RM-005] 风险事件采集定时任务
 * 文件: riskEventCollection.job.ts
 * 需求描述: 每 5 分钟调度一次外部风险事件采集，确保端到端延迟 < 30 分钟
 * 最后更新: 2026-08-25
 */
import cron, { ScheduledTask } from 'node-cron';
import { RiskEventCollectorService } from '../services/riskEventCollector.service';
import { RiskEventService } from '../services/riskEvent.service';
import logger from '../utils/logger';

export function scheduleRiskEventCollection(): ReturnType<typeof cron.schedule> {
  // 每 5 分钟执行一次
  return cron.schedule('*/5 * * * *', async () => {
    logger.info('Running risk event collection job');
    try {
      const result = await RiskEventCollectorService.collectAll();
      logger.info('Risk event collection job completed', { total: result.total, bySource: result.bySource });

      // 采集完成后，为活跃用户匹配事件（骨架：后续可改为按用户分批/异步）
      if (result.total > 0) {
        // 注意：matchEventsForUser 需要 user_id，这里仅作示例记录；
        // 实际生产环境建议通过消息队列按用户异步触发匹配。
        logger.info('New risk events collected, matching will be triggered on next user request');
      }
    } catch (error: any) {
      logger.error('Risk event collection job failed', { error: error.message });
    }
  });
}
