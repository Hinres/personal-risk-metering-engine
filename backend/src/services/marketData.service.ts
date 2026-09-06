/**
 * [PRME-INFRA-004] 市场数据
 * 文件: marketData.service.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { MarketData } from '../models/MarketData';
import { Holding } from '../models/Holding';
import axios from 'axios';
import logger from '../utils/logger';

const marketRepo = () => AppDataSource.getRepository(MarketData);
const holdingRepo = () => AppDataSource.getRepository(Holding);

const TUSHARE_API_URL = 'http://api.tushare.pro';
const getTushareToken = () => process.env.TUSHARE_TOKEN || '';

// 非生产环境下，未配置 Tushare 或数据库无数据时，使用确定性 mock 数据（ISS-001）
const isMockEnabled = () => {
  if (process.env.MARKET_DATA_MOCK === 'false') return false;
  if (process.env.MARKET_DATA_MOCK === 'true') return true;
  return process.env.NODE_ENV !== 'production' && !getTushareToken();
};

/**
 * 生成确定性 mock 历史价格序列
 * 基于 symbol 派生随机种子，保证同一 symbol 每次生成相同序列
 */
const generateMockPrices = (symbol: string, days: number): { trade_date: string; close_price: number }[] => {
  // 用 symbol 派生基础价格，避免所有 symbol 价格相同
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 100000;
  }
  const basePrice = 10 + (seed % 90); // 10 ~ 100
  const volatility = 0.02 + (seed % 10) / 1000; // 2% ~ 3% 日波动

  const prices: { trade_date: string; close_price: number }[] = [];
  const today = new Date();
  let price = basePrice;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // 跳过周末
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // 简单的伪随机游走
    const rand = Math.sin(seed + i) * 2; // -2 ~ 2
    const change = rand * volatility;
    price = Math.max(1, price * (1 + change));

    prices.push({
      trade_date: date.toISOString().slice(0, 10),
      close_price: parseFloat(price.toFixed(4)),
    });
  }

  return prices;
};

export class MarketDataService {
  static async getLatestPrice(symbol: string) {
    const latest = await marketRepo().findOne({
      where: { symbol },
      order: { trade_date: 'DESC' },
    });
    if (latest?.close_price !== null && latest?.close_price !== undefined) {
      return latest.close_price;
    }

    if (isMockEnabled()) {
      logger.warn('Using mock latest price for symbol', { symbol });
      const mockPrices = generateMockPrices(symbol, 30);
      return mockPrices[mockPrices.length - 1]?.close_price ?? null;
    }

    return null;
  }

  static async getHistory(symbol: string, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const records = await marketRepo().createQueryBuilder()
      .where('symbol = :symbol', { symbol })
      .andWhere('trade_date >= :cutoff', { cutoff })
      .orderBy('trade_date', 'DESC')
      .take(days)
      .getMany();

    if (records.length >= 2) {
      return records;
    }

    if (isMockEnabled()) {
      logger.warn('Using mock historical prices for symbol', { symbol, days });
      const mockPrices = generateMockPrices(symbol, days);
      return mockPrices.map(p => marketRepo().create({
        symbol,
        trade_date: p.trade_date,
        close_price: p.close_price,
        security_type: 'stock',
        exchange: 'MOCK',
      }));
    }

    return records;
  }

  static async getReturnsMatrix(symbols: string[], days = 252) {
    const priceData: Record<string, number[]> = {};

    for (const symbol of symbols) {
      const history = await this.getHistory(symbol, days + 1);
      const prices = history.map(h => parseFloat(h.close_price?.toString() || '0')).reverse();
      if (prices.length < 2) {
        throw new Error(`Insufficient historical data for ${symbol}`);
      }
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      priceData[symbol] = returns;
    }

    const minLength = Math.min(...Object.values(priceData).map(r => r.length));
    const matrix: number[][] = [];
    for (let i = 0; i < minLength; i++) {
      const row: number[] = [];
      for (const symbol of symbols) {
        row.push(priceData[symbol][i]);
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * 调用 Tushare API 获取股票基础信息
   */
  static async getStockBasic() {
    if (!getTushareToken()) {
      logger.warn('TUSHARE_TOKEN not set, skipping stock basic sync');
      return [];
    }
    try {
      const res = await axios.post(TUSHARE_API_URL, {
        token: getTushareToken(),
        api_name: 'stock_basic',
        params: { exchange: '', list_status: 'L' },
        fields: 'ts_code,symbol,name,area,industry,market,list_date',
      });
      if (res.data?.data?.fields && res.data?.data?.items) {
        const fields = res.data.data.fields;
        const items = res.data.data.items;
        return items.map((item: any[]) => {
          const row: Record<string, any> = {};
          fields.forEach((f: string, i: number) => row[f] = item[i]);
          return row;
        });
      }
      return [];
    } catch (e: any) {
      logger.error('Tushare stock_basic failed', { error: e.message });
      return [];
    }
  }

  /**
   * 调用 Tushare API 获取日线行情
   */
  static async getDailyQuote(symbol: string, startDate?: string, endDate?: string) {
    if (!getTushareToken()) {
      logger.warn('TUSHARE_TOKEN not set, skipping daily quote sync');
      return [];
    }
    const tsCode = symbol.includes('.') ? symbol : this.toTsCode(symbol);
    const params: Record<string, string> = { ts_code: tsCode };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    try {
      const res = await axios.post(TUSHARE_API_URL, {
        token: getTushareToken(),
        api_name: 'daily',
        params,
        fields: 'ts_code,trade_date,open,high,low,close,vol,amount',
      });
      if (res.data?.data?.fields && res.data?.data?.items) {
        const fields = res.data.data.fields;
        const items = res.data.data.items;
        return items.map((item: any[]) => {
          const row: Record<string, any> = {};
          fields.forEach((f: string, i: number) => row[f] = item[i]);
          return row;
        });
      }
      return [];
    } catch (e: any) {
      logger.error('Tushare daily failed', { error: e.message, symbol });
      return [];
    }
  }

  /**
   * 调用 Tushare API 获取每日基本面指标（PE/PB/股息率/市值/换手率）
   * PRME-v1.3-PA-003 §4.2：分批（每批 ≤50），无 Token 时 warn + 返回空数组，
   * 空结果不视为错误，由上层触发降级路径。
   */
  static async getDailyBasic(symbols: string[], tradeDate?: string): Promise<any[]> {
    if (!getTushareToken()) {
      logger.warn('TUSHARE_TOKEN not set, skipping daily_basic sync');
      return [];
    }
    const results: any[] = [];
    for (let i = 0; i < symbols.length; i += 50) {
      const batch = symbols.slice(i, i + 50).map(s => this.toTsCode(s));
      const params: Record<string, string> = { ts_code: batch.join(',') };
      if (tradeDate) params.trade_date = tradeDate.replace(/-/g, '');
      try {
        const res = await axios.post(TUSHARE_API_URL, {
          token: getTushareToken(),
          api_name: 'daily_basic',
          params,
          fields: 'ts_code,trade_date,pe_ttm,pb,dv_ratio,total_mv,turnover_rate',
        });
        if (res.data?.data?.fields && res.data?.data?.items) {
          const fields = res.data.data.fields;
          results.push(...res.data.data.items.map((item: any[]) => {
            const row: Record<string, any> = {};
            fields.forEach((f: string, j: number) => row[f] = item[j]);
            return row;
          }));
        }
      } catch (e: any) {
        logger.error('Tushare daily_basic failed', { error: e.message, batchIndex: i / 50 });
      }
    }
    return results;
  }

  /**
   * 调用 Tushare 财务报表接口（income / balancesheet / cashflow）
   * PRME-v1.3-PA-003 §4.3：季报窗口期同步，写入 financial_data。
   * 无 Token 时 warn + 返回空数组。
   */
  static async getFinancialReport(apiName: 'income' | 'balancesheet' | 'cashflow', tsCode: string): Promise<any[]> {
    if (!getTushareToken()) {
      logger.warn('TUSHARE_TOKEN not set, skipping financial report sync');
      return [];
    }
    try {
      const res = await axios.post(TUSHARE_API_URL, {
        token: getTushareToken(),
        api_name: apiName,
        params: { ts_code: tsCode, limit: 8 },
      });
      if (res.data?.data?.fields && res.data?.data?.items) {
        const fields = res.data.data.fields;
        return res.data.data.items.map((item: any[]) => {
          const row: Record<string, any> = {};
          fields.forEach((f: string, j: number) => row[f] = item[j]);
          return row;
        });
      }
      return [];
    } catch (e: any) {
      logger.error(`Tushare ${apiName} failed`, { error: e.message, tsCode });
      return [];
    }
  }

  private static toTsCode(symbol: string): string {
    const s = symbol.trim();
    if (s.startsWith('6')) return `${s}.SH`;
    if (s.startsWith('0') || s.startsWith('3')) return `${s}.SZ`;
    if (s.startsWith('8') || s.startsWith('4')) return `${s}.BJ`;
    return s;
  }

  private static fromTsCode(tsCode: string): string {
    return tsCode.split('.')[0];
  }

  /**
   * 同步指定股票列表的市场数据（从 Tushare）
   */
  static async syncFromTushare(symbols: string[]) {
    if (!getTushareToken()) {
      logger.warn('TUSHARE_TOKEN not set, cannot sync from Tushare');
      return { synced: 0, failed: symbols.length };
    }
    logger.info(`Syncing ${symbols.length} symbols from Tushare`);
    let synced = 0;
    let failed = 0;
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const startDate = start.toISOString().slice(0, 10).replace(/-/g, '');

    for (const symbol of symbols) {
      try {
        const quotes = await this.getDailyQuote(symbol, startDate, endDate);
        if (!quotes.length) {
          failed++;
          continue;
        }
        const entities = quotes.map((q: any) => ({
          symbol: this.fromTsCode(q.ts_code || symbol),
          trade_date: q.trade_date ? `${q.trade_date.slice(0, 4)}-${q.trade_date.slice(4, 6)}-${q.trade_date.slice(6, 8)}` : new Date(),
          open_price: q.open,
          high_price: q.high,
          low_price: q.low,
          close_price: q.close,
          volume: q.vol,
          turnover: q.amount,
          security_type: 'stock',
          exchange: this.exchangeFromSymbol(symbol),
        }));
        await this.saveMarketData(entities);
        synced++;
      } catch (e: any) {
        logger.error(`Sync failed for ${symbol}`, { error: e.message });
        failed++;
      }
    }
    logger.info(`Tushare sync completed: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  private static exchangeFromSymbol(symbol: string): string {
    const s = symbol.trim();
    if (s.startsWith('6')) return 'SH';
    if (s.startsWith('0') || s.startsWith('3')) return 'SZ';
    if (s.startsWith('8') || s.startsWith('4')) return 'BJ';
    return 'SH';
  }

  /**
   * 获取所有需要跟踪的 symbols（从 holdings 表去重）
   */
  static async getTrackedSymbols(): Promise<string[]> {
    const holdings = await holdingRepo().find();
    const symbols = [...new Set(holdings.map(h => h.symbol))];
    return symbols;
  }

  static async saveMarketData(data: Partial<MarketData>[]) {
    const repo = marketRepo();
    if (!data.length) return 0;

    // 去重：查询已存在的记录，避免重复插入
    const symbols = [...new Set(data.map(d => d.symbol).filter(Boolean) as string[])];
    const dates = [...new Set(data.map(d => d.trade_date).filter(Boolean))];

    if (symbols.length && dates.length) {
      const existing = await repo.createQueryBuilder('md')
        .select(['md.symbol', 'md.trade_date'])
        .where('md.symbol IN (:...symbols)', { symbols })
        .andWhere('md.trade_date IN (:...dates)', { dates })
        .getMany();

      const existingSet = new Set(
        existing.map(e => {
          const d = e.trade_date instanceof Date
            ? e.trade_date.toISOString().slice(0, 10)
            : String(e.trade_date).slice(0, 10);
          return `${e.symbol}|${d}`;
        })
      );

      const newData = data.filter(d => {
        const dateStr = d.trade_date instanceof Date
          ? d.trade_date.toISOString().slice(0, 10)
          : String(d.trade_date).slice(0, 10);
        return !existingSet.has(`${d.symbol}|${dateStr}`);
      });

      if (!newData.length) return 0;
      data = newData;
    }

    const entities = data.map(d => repo.create(d));
    await repo.save(entities);
    return entities.length;
  }
}
