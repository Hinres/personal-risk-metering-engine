/**
 * [PRME-v1.3.1-F03] 市场波动率日更定时任务
 * 文件: marketVolatility.job.ts
 * 需求描述: 每交易日盘后（17:30）批量计算全部活跃指数波动率并落 history 表
 * 设计来源: PRME-v1.3.1-Detailed-Design-20260918.md §3.2 阶段 A
 * 日期: 2026-09-18
 */
import cron from 'node-cron';
import { MarketVolatilityService } from '../services/marketVolatility.service';
import logger from '../utils/logger';

/**
 * 执行一次波动率计算（当日幂等，由 calculateAndSaveAll 内部保证）
 * 抽出独立函数便于测试与手动触发
 */
export async function runMarketVolatilityCalculation(): Promise<number> {
  try {
    const saved = await MarketVolatilityService.calculateAndSaveAll();
    logger.info(`Market volatility calculation finished, saved ${saved} indices`);
    return saved;
  } catch (error: any) {
    logger.error('Market volatility calculation failed', { error: error.message });
    return 0;
  }
}

/**
 * 调度市场波动率日更任务
 * 每交易日（周一至周五）17:30（Asia/Shanghai，盘后）执行
 */
export function scheduleMarketVolatility(): ReturnType<typeof cron.schedule> {
  return cron.schedule(
    '30 17 * * 1-5',
    async () => {
      logger.info('Running daily market volatility calculation');
      await runMarketVolatilityCalculation();
    },
    { scheduled: true, timezone: 'Asia/Shanghai' }
  );
}
