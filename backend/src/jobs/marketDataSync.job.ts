/**
 * [PRME-INFRA-004] 市场数据
 * 文件: marketDataSync.job.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import cron, { ScheduledTask } from 'node-cron';
import { MarketDataService } from '../services/marketData.service';
import logger from '../utils/logger';

export function scheduleMarketDataSync(): ReturnType<typeof cron.schedule> {
  // 每天 09:30 开盘后同步一次
  return cron.schedule('30 9 * * *', async () => {
    logger.info('Starting daily market data sync');
    try {
      const symbols = await MarketDataService.getTrackedSymbols();
      if (!symbols.length) {
        logger.info('No tracked symbols found, skipping sync');
        return;
      }
      const result = await MarketDataService.syncFromTushare(symbols);
      logger.info(`Market data sync completed: ${result.synced} synced, ${result.failed} failed`);
    } catch (error: any) {
      logger.error('Market data sync failed', { error: error.message });
    }
  });
};
