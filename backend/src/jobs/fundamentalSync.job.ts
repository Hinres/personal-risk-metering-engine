/**
 * [PRME-v1.3-PA-003] 基本面数据每日同步
 * 文件: fundamentalSync.job.ts
 * 需求描述: 每日收盘后同步 daily_basic 快照；季报窗口期同步三大报表至 financial_data
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §4.3
 * 最后更新: 2026-09-06
 */
import cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { Stock } from '../models/Stock';
import { Holding } from '../models/Holding';
import { StockDailyBasic } from '../models/StockDailyBasic';
import { FinancialData } from '../models/FinancialData';
import { MarketDataService } from '../services/marketData.service';
import logger from '../utils/logger';

const stockRepo = () => AppDataSource.getRepository(Stock);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const dailyBasicRepo = () => AppDataSource.getRepository(StockDailyBasic);
const financialRepo = () => AppDataSource.getRepository(FinancialData);

const toDateStr = (v: any): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

/**
 * 同步范围：stocks 全表 ∪ 所有用户当前持仓（并集）
 */
async function getSyncSymbols(): Promise<string[]> {
  const stocks = await stockRepo().find({ select: { symbol: true } as any });
  const holdings = await holdingRepo().find({ select: { symbol: true } as any });
  return [...new Set([...stocks.map(s => s.symbol), ...holdings.map(h => h.symbol)])];
}

/**
 * 动作 1：daily_basic 最新交易日快照 → upsert stock_daily_basic
 */
async function syncDailyBasic(symbols: string[]): Promise<number> {
  // 已同步过的最新交易日（增量对齐 Tushare 已落地数据）；首次为空则传 undefined 取最新
  const latest = await dailyBasicRepo().createQueryBuilder('sdb')
    .select('MAX(sdb.trade_date)', 'max_date')
    .getRawOne();
  const tradeDate = latest?.max_date ? toDateStr(latest.max_date) : undefined;

  const rows = await MarketDataService.getDailyBasic(symbols, tradeDate);
  if (!rows.length) return 0;

  let upserted = 0;
  for (const row of rows) {
    try {
      const symbol = String(row.ts_code || '').split('.')[0];
      if (!symbol) continue;
      const tradeDateStr = toDateStr(
        row.trade_date && String(row.trade_date).length === 8
          ? `${row.trade_date.slice(0, 4)}-${row.trade_date.slice(4, 6)}-${row.trade_date.slice(6, 8)}`
          : row.trade_date
      );
      const existing = await dailyBasicRepo().findOne({ where: { symbol, trade_date: tradeDateStr as any } });
      const values = {
        symbol,
        trade_date: tradeDateStr,
        pe_ttm: row.pe_ttm != null ? Number(row.pe_ttm) : null,
        pb: row.pb != null ? Number(row.pb) : null,
        dv_ratio: row.dv_ratio != null ? Number(row.dv_ratio) : null,
        total_mv: row.total_mv != null ? Number(row.total_mv) : null,
        turnover_rate: row.turnover_rate != null ? Number(row.turnover_rate) : null,
      };
      if (existing) {
        await dailyBasicRepo().merge(existing, values);
        await dailyBasicRepo().save(existing);
      } else {
        await dailyBasicRepo().save(dailyBasicRepo().create(values));
      }
      upserted++;
    } catch (e: any) {
      // 单 symbol 失败仅记 error 日志继续（§4.3 失败处理）
      logger.error('daily_basic upsert failed', { error: e.message, ts_code: row.ts_code });
    }
  }
  return upserted;
}

/**
 * 动作 2：季报窗口期（1/4/7/10 月前 10 日）同步三大报表 → financial_data
 */
async function syncFinancialReports(symbols: string[]): Promise<number> {
  const now = new Date();
  const isWindow = [1, 4, 7, 10].includes(now.getMonth() + 1) && now.getDate() <= 10;
  if (!isWindow) return 0;

  const stockMap = new Map<string, Stock>();
  (await stockRepo().find()).forEach(s => stockMap.set(s.symbol, s));

  let upserted = 0;
  for (const symbol of symbols) {
    const stock = stockMap.get(symbol);
    if (!stock) continue;
    try {
      const tsCode = symbol.includes('.') ? symbol
        : symbol.startsWith('6') ? `${symbol}.SH`
        : (symbol.startsWith('0') || symbol.startsWith('3')) ? `${symbol}.SZ`
        : symbol.startsWith('8') || symbol.startsWith('4') ? `${symbol}.BJ` : `${symbol}.SH`;

      const [incomeRows, balanceRows, cashRows] = await Promise.all([
        MarketDataService.getFinancialReport('income', tsCode),
        MarketDataService.getFinancialReport('balancesheet', tsCode),
        MarketDataService.getFinancialReport('cashflow', tsCode),
      ]);
      if (!incomeRows.length && !balanceRows.length && !cashRows.length) continue;

      // 按报告期归并（取每期最新公告版本）
      const byPeriod = new Map<string, { income?: any; balance?: any; cash?: any }>();
      const collect = (rows: any[], key: 'income' | 'balance' | 'cash') => {
        for (const r of rows) {
          const endDate = String(r.end_date || '');
          if (!/^\d{8}$/.test(endDate)) continue;
          const y = endDate.slice(0, 4);
          const m = endDate.slice(4, 6);
          const period = m === '12' ? y : `${y}Q${Math.ceil(Number(m) / 3)}`;
          const entry = byPeriod.get(period) || {};
          if (!entry[key] || String(r.ann_date || '') >= String(entry[key].ann_date || '')) {
            entry[key] = r;
            byPeriod.set(period, entry);
          }
        }
      };
      collect(incomeRows, 'income');
      collect(balanceRows, 'balance');
      collect(cashRows, 'cash');

      for (const [period, data] of byPeriod) {
        const reportType = /Q/.test(period) ? 'quarterly' : 'annual';
        const existing = await financialRepo().findOne({
          where: { stock_id: stock.stock_id, report_period: period, report_type: reportType },
        });
        const values = {
          stock_id: stock.stock_id,
          report_period: period,
          report_type: reportType,
          revenue: data.income?.total_revenue != null ? Number(data.income.total_revenue) : (existing?.revenue ?? null),
          net_profit: data.income?.n_income_attr_p != null ? Number(data.income.n_income_attr_p) : (existing?.net_profit ?? null),
          operating_profit: data.income?.operate_profit != null ? Number(data.income.operate_profit) : (existing?.operating_profit ?? null),
          total_assets: data.balance?.total_assets != null ? Number(data.balance.total_assets) : (existing?.total_assets ?? null),
          total_liabilities: data.balance?.total_liab != null ? Number(data.balance.total_liab) : (existing?.total_liabilities ?? null),
          shareholders_equity: data.balance?.total_hldr_eqy_exc_min_int != null ? Number(data.balance.total_hldr_eqy_exc_min_int) : (existing?.shareholders_equity ?? null),
          operating_cash_flow: data.cash?.n_cashflow_act != null ? Number(data.cash.n_cashflow_act) : (existing?.operating_cash_flow ?? null),
        };
        if (existing) {
          await financialRepo().merge(existing, values);
          await financialRepo().save(existing);
        } else {
          await financialRepo().save(financialRepo().create(values));
        }
        upserted++;
      }
    } catch (e: any) {
      // 单 symbol 失败仅记 error 日志继续（§4.3 失败处理）
      logger.error('financial report sync failed', { error: e.message, symbol });
    }
  }
  return upserted;
}

export async function runFundamentalSync(): Promise<{ daily_basic: number; financial: number }> {
  if (process.env.FUNDAMENTAL_SYNC_ENABLED === 'false') {
    logger.info('FUNDAMENTAL_SYNC_ENABLED=false, skipping fundamental sync');
    return { daily_basic: 0, financial: 0 };
  }
  if (!process.env.TUSHARE_TOKEN) {
    logger.warn('TUSHARE_TOKEN not set, fundamental sync job skips itself');
    return { daily_basic: 0, financial: 0 };
  }

  const symbols = await getSyncSymbols();
  if (!symbols.length) {
    logger.info('No symbols to sync, skipping fundamental sync');
    return { daily_basic: 0, financial: 0 };
  }

  const dailyBasicCount = await syncDailyBasic(symbols);
  const financialCount = await syncFinancialReports(symbols);
  logger.info(`Fundamental sync completed: daily_basic=${dailyBasicCount}, financial=${financialCount}, symbols=${symbols.length}`);
  return { daily_basic: dailyBasicCount, financial: financialCount };
}

export function scheduleFundamentalSync(): ReturnType<typeof cron.schedule> {
  // 每日 17:40（A股 15:00 收盘 + 数据落地缓冲）
  return cron.schedule('40 17 * * *', async () => {
    logger.info('Starting fundamental sync');
    try {
      await runFundamentalSync();
    } catch (error: any) {
      logger.error('Fundamental sync failed, retrying once', { error: error.message });
      try {
        await runFundamentalSync();
      } catch (retryError: any) {
        logger.error('Fundamental sync failed after retry', { error: retryError.message });
      }
    }
  });
}
