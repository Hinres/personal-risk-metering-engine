#!/usr/bin/env tsx
/**
 * [PRME-v1.3.1-F03B] 市场波动率历史数据一次性回填脚本
 * 文件: backfill-volatility-history.ts
 * 需求描述: 对每个活跃指数，回填最近 35 个交易日的"截至当日"滚动波动率，
 *           使 /api/v1/market/volatility/trends 即刻可返回最近 30 期趋势
 * 设计来源: PRME-v1.3.1-Detailed-Design-20260918.md §3.2 阶段 B
 * 运行方式: npx tsx scripts/backfill-volatility-history.ts [--days 35]
 * 注意: 一次性脚本，不进 cron；幂等（index_symbol + calculation_date 已存在则跳过）
 * 日期: 2026-09-18
 */
import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, closeDatabase, AppDataSource } from '../src/config/database';
import { MarketVolatilityIndex } from '../src/models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../src/models/MarketVolatilityHistory';
import { MarketData } from '../src/models/MarketData';
import { MarketVolatilityService } from '../src/services/marketVolatility.service';
import logger from '../src/utils/logger';

const DEFAULT_DAYS = 35;

async function main() {
  const daysArgIdx = process.argv.indexOf('--days');
  const days = daysArgIdx > -1 ? parseInt(process.argv[daysArgIdx + 1], 10) : DEFAULT_DAYS;
  if (!Number.isFinite(days) || days < 2) {
    console.error('Invalid --days value');
    process.exit(1);
  }

  await initializeDatabase();

  try {
    const indexRepo = AppDataSource.getRepository(MarketVolatilityIndex);
    const historyRepo = AppDataSource.getRepository(MarketVolatilityHistory);
    const marketRepo = AppDataSource.getRepository(MarketData);

    const indices = await indexRepo.find({ where: { is_active: true } });
    if (!indices.length) {
      logger.warn('[backfill] No active volatility indices configured, nothing to do.');
      return;
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const idx of indices) {
      // 取该指数最近 `days` 个有行情的交易日
      const recent = await marketRepo
        .createQueryBuilder('m')
        .select(['m.trade_date'])
        .where('m.symbol = :symbol', { symbol: idx.index_symbol })
        .orderBy('m.trade_date', 'DESC')
        .take(days)
        .getMany();

      const tradeDates = recent
        .map(r => (typeof r.trade_date === 'string' ? r.trade_date : new Date(r.trade_date).toISOString().slice(0, 10)))
        .sort();

      if (tradeDates.length < 21) {
        logger.warn(`[backfill] ${idx.index_symbol}: only ${tradeDates.length} trade dates (< 21), skipped`);
        continue;
      }

      for (const d of tradeDates) {
        const existing = await historyRepo.findOne({
          where: { index_symbol: idx.index_symbol, calculation_date: d },
        });
        if (existing) {
          totalSkipped++;
          continue;
        }

        const computed = await MarketVolatilityService.calculateIndexVolatilityAsOf(idx.index_symbol, d);
        if (computed.volatility <= 0) {
          logger.warn(`[backfill] ${idx.index_symbol} as of ${d}: volatility=0, skipped`);
          continue;
        }

        await historyRepo.save(historyRepo.create({
          index_symbol: idx.index_symbol,
          volatility: computed.volatility,
          percentile: computed.percentile,
          calculation_date: d,
          data_points: 252,
        }));
        totalInserted++;
      }

      logger.info(`[backfill] ${idx.index_symbol}: processed ${tradeDates.length} trade dates`);
    }

    logger.info(`[backfill] Done. inserted=${totalInserted}, skipped(existing)=${totalSkipped}`);
    console.log(`Backfill complete: inserted=${totalInserted}, skipped=${totalSkipped}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
