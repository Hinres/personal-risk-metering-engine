/**
 * [PRME-v1.3-PA-001] 组合快照定时任务
 * 文件: dailyPortfolioSnapshot.job.ts
 * 需求描述: 每日收盘后为所有活跃组合生成快照，支撑历史对比功能
 * 最后更新: 2026-08-25
 */
import cron, { ScheduledTask } from 'node-cron';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { PortfolioSnapshotService } from '../services/portfolioSnapshot.service';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

export function scheduleDailyPortfolioSnapshot(): ReturnType<typeof cron.schedule> {
  // 每个交易日 15:05 执行（A股收盘后 15:00，预留 5 分钟等待市场数据同步）
  return cron.schedule('5 15 * * *', async () => {
    logger.info('Running daily portfolio snapshot job');
    try {
      const portfolios = await portfolioRepo().find({ where: { status: 'active' } });
      let success = 0;
      let failed = 0;

      for (const portfolio of portfolios) {
        try {
          await PortfolioSnapshotService.createSnapshot(portfolio.portfolio_id);
          success++;
        } catch (e: any) {
          failed++;
          logger.error(`Failed to create snapshot for portfolio ${portfolio.portfolio_id}`, { error: e.message });
        }
      }

      logger.info(`Daily portfolio snapshot job completed: ${success} success, ${failed} failed`);
    } catch (error: any) {
      logger.error('Daily portfolio snapshot job failed', { error: error.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai',
  });
}
