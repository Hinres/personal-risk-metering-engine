/**
 * [PRME-VAR-001] 组合VaR计算 — 定时任务
 * 文件: varCalculation.job.ts
 * 需求描述: 每日VaR计算定时任务，使用内存锁替代Redis分布式锁
 * 关联: arc v1.2 架构设计（剔除Redis）
 * 最后更新: 2026-06-14
 */
import cron, { ScheduledTask } from 'node-cron';
import { VaRService } from '../services/var.service';
import { PortfolioService } from '../services/portfolio.service';
import logger from '../utils/logger';

let lockAcquired = false;
const LOCK_TIMEOUT_MS = 3600000; // 1 hour max lock time
let lockTimer: NodeJS.Timeout | null = null;

export const acquireLock = async (): Promise<boolean> => {
  if (lockAcquired) return false;
  lockAcquired = true;
  // 自动释放锁（防止进程崩溃导致永久锁死）
  lockTimer = setTimeout(() => {
    logger.warn('VaR calculation lock auto-released after timeout');
    lockAcquired = false;
  }, LOCK_TIMEOUT_MS);
  return true;
};

export const releaseLock = async (): Promise<void> => {
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
  lockAcquired = false;
};

export function scheduleVaRCalculation(): ReturnType<typeof cron.schedule> {
  // Run every day at 6:00 PM (after market close)
  return cron.schedule('0 18 * * *', async () => {
    if (!(await acquireLock())) {
      logger.warn('Daily VaR calculation already in progress on another instance, skipping');
      return;
    }
    
    logger.info('Starting daily VaR calculation');
    
    try {
      const { portfolios } = await PortfolioService.getAllPortfolios(1, 1000);
      const batchSize = 10; // Process in batches to avoid overwhelming the calc engine
      
      for (let i = 0; i < portfolios.length; i += batchSize) {
        const batch = portfolios.slice(i, i + batchSize);
        await Promise.all(batch.map(async (portfolio) => {
          try {
            await VaRService.calculate(portfolio.user_id, portfolio.portfolio_id, {
              confidence_level: 0.95,
              time_horizon: 1,
              method: 'historical',
            });
          } catch (e: any) {
            logger.error(`VaR calc failed for portfolio ${portfolio.portfolio_id}`, { error: e.message });
          }
        }));
        
        // Small delay between batches to reduce load
        if (i + batchSize < portfolios.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      logger.info(`Daily VaR calculation completed for ${portfolios.length} portfolios`);
    } catch (error: any) {
      logger.error('VaR calculation job failed', { error: error.message });
    } finally {
      await releaseLock();
    }
  });
}
