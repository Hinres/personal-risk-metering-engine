/**
 * [PRME-v1.3-RM-006] 市场波动率监控
 * 文件: marketVolatility.service.ts
 * 需求描述: 计算并维护市场综合波动率指标
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { MarketVolatilityIndex } from '../models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../models/MarketVolatilityHistory';
import { MarketData } from '../models/MarketData';
import { MarketDataService } from './marketData.service';
import logger from '../utils/logger';
import Decimal from 'decimal.js';

const indexRepo = () => AppDataSource.getRepository(MarketVolatilityIndex);
const historyRepo = () => AppDataSource.getRepository(MarketVolatilityHistory);

const RISK_FREE_RATE = 0.025;

export interface VolatilityComponent {
  index_symbol: string;
  index_name: string;
  volatility: number;
  weight: number;
  percentile: number | null;
}

export interface VolatilitySummary {
  composite_volatility: number;
  composite_volatility_pct: number;
  historical_percentile: number;
  status: 'normal' | 'elevated' | 'high';
  status_text: string;
  components: VolatilityComponent[];
  updated_at: string;
  disclaimer: string;
}

export class MarketVolatilityService {
  /**
   * 获取上一交易日综合波动率（用于波动率异常监控的日环比计算）
   */
  static async getPreviousCompositeVolatility(): Promise<number | null> {
    const indices = await indexRepo().find({ where: { is_active: true }, order: { weight: 'DESC' } });
    if (!indices.length) return null;

    const today = new Date().toISOString().slice(0, 10);
    let previousVol: number | null = null;

    for (let daysBack = 1; daysBack <= 5; daysBack++) {
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().slice(0, 10);
      let weightedVol = new Decimal(0);
      let totalWeight = 0;
      let hasAny = false;

      for (const idx of indices) {
        const hist = await historyRepo().findOne({
          where: { index_symbol: idx.index_symbol, calculation_date: dateStr },
        });
        if (hist) {
          weightedVol = weightedVol.plus(new Decimal(hist.volatility).times(idx.weight));
          totalWeight += Number(idx.weight);
          hasAny = true;
        }
      }

      if (hasAny) {
        previousVol = totalWeight > 0 ? Number(weightedVol.div(totalWeight).toFixed(6)) : Number(weightedVol.toFixed(6));
        break;
      }
    }

    return previousVol;
  }

  /**
   * 获取当前综合波动率
   */
  static async getCurrentVolatility(): Promise<VolatilitySummary> {
    const indices = await indexRepo().find({ where: { is_active: true }, order: { weight: 'DESC' } });
    if (!indices.length) {
      throw new Error('No active volatility indices configured');
    }

    const components: VolatilityComponent[] = [];
    let weightedVol = new Decimal(0);
    const today = new Date().toISOString().slice(0, 10);

    for (const idx of indices) {
      const latest = await historyRepo().findOne({
        where: { index_symbol: idx.index_symbol },
        order: { calculation_date: 'DESC' },
      });

      let vol = 0;
      let percentile: number | null = null;
      if (latest) {
        vol = Number(latest.volatility);
        percentile = latest.percentile ? Number(latest.percentile) : null;
      } else {
        // 没有历史记录时，尝试实时计算
        const computed = await this.calculateIndexVolatility(idx.index_symbol);
        vol = computed.volatility;
        percentile = computed.percentile;
      }

      const weight = Number(idx.weight);
      weightedVol = weightedVol.plus(new Decimal(vol).times(weight));
      components.push({
        index_symbol: idx.index_symbol,
        index_name: idx.index_name,
        volatility: Number(vol.toFixed(6)),
        weight,
        percentile,
      });
    }

    const composite = Number(weightedVol.toFixed(6));
    const compositePct = Number((composite * 100).toFixed(2));

    // 使用历史最高分位作为综合分位近似
    const compositePercentile = Math.round(
      components.reduce((sum, c) => sum + (c.percentile || 0) * c.weight, 0) * 100
    ) / 100;

    let status: 'normal' | 'elevated' | 'high' = 'normal';
    let statusText = '波动率正常';
    if (compositePercentile > 80) {
      status = 'high';
      statusText = '波动率偏高';
    } else if (compositePercentile > 60) {
      status = 'elevated';
      statusText = '波动率偏高';
    }

    return {
      composite_volatility: composite,
      composite_volatility_pct: compositePct,
      historical_percentile: compositePercentile,
      status,
      status_text: statusText,
      components,
      updated_at: new Date().toISOString(),
      disclaimer: '本波动率指标基于历史收益率滚动标准差计算，仅供参考，不构成投资建议。',
    };
  }

  /**
   * 获取波动率趋势
   */
  static async getVolatilityTrend(granularity: 'daily' | 'weekly' | 'monthly' = 'daily', period = 30) {
    const indices = await indexRepo().find({ where: { is_active: true }, order: { weight: 'DESC' } });
    if (!indices.length) throw new Error('No active volatility indices configured');

    const primaryIndex = indices[0];
    let query = historyRepo().createQueryBuilder('h')
      .where('h.index_symbol = :symbol', { symbol: primaryIndex.index_symbol })
      .orderBy('h.calculation_date', 'DESC')
      .take(period);

    if (granularity === 'weekly') query = query.take(period * 7);
    if (granularity === 'monthly') query = query.take(period * 30);

    const rows = await query.getMany();

    const trends = rows.reverse().map((row) => ({
      date: row.calculation_date,
      value: Number(row.volatility),
      percentile: row.percentile ? Number(row.percentile) : null,
    }));

    return { granularity, period, trends };
  }

  /**
   * 计算单指数年化波动率及历史分位
   */
  static async calculateIndexVolatility(symbol: string, window = 252) {
    const history = await MarketDataService.getHistory(symbol, window + 1);
    if (history.length < 21) {
      logger.warn(`Insufficient data for volatility index ${symbol}: ${history.length} days`);
      return { volatility: 0, percentile: 0 };
    }

    // getHistory 按 trade_date DESC 返回，反转为时间升序
    const prices = history.map(h => parseFloat(h.close_price?.toString() || '0')).reverse();
    return this.computeRollingVolatility(prices);
  }

  /**
   * F-03B：计算“截至 asOfDate（含当日）”的滚动 20 日年化波动率与历史分位。
   * 与 calculateIndexVolatility 复用同一滚动窗口算法；
   * 当 asOfDate 为最新交易日时，两者结果一致（交叉验证基准）。
   */
  static async calculateIndexVolatilityAsOf(symbol: string, asOfDate: string, window = 252) {
    const records = await AppDataSource.getRepository(MarketData)
      .createQueryBuilder('m')
      .where('m.symbol = :symbol', { symbol })
      .andWhere('m.trade_date <= :asOf', { asOf: asOfDate })
      .orderBy('m.trade_date', 'DESC')
      .take(window + 1)
      .getMany();

    if (records.length < 21) {
      logger.warn(`Insufficient data for volatility index ${symbol} as of ${asOfDate}: ${records.length} days`);
      return { volatility: 0, percentile: 0 };
    }

    const prices = records.map(h => parseFloat(h.close_price?.toString() || '0')).reverse();
    return this.computeRollingVolatility(prices);
  }

  /**
   * 滚动 20 日年化波动率核心算法（时间升序价格序列 → 最新值 + 池内分位）
   */
  private static computeRollingVolatility(prices: number[]): { volatility: number; percentile: number } {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const rollingWindow = Math.min(20, returns.length);
    const rollingVols: number[] = [];
    for (let i = rollingWindow; i <= returns.length; i++) {
      const slice = returns.slice(i - rollingWindow, i);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / slice.length;
      rollingVols.push(Math.sqrt(variance) * Math.sqrt(252));
    }

    const currentVol = rollingVols[rollingVols.length - 1];
    const sorted = [...rollingVols].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= currentVol).length;
    const percentile = rollingVols.length > 0 ? rank / rollingVols.length : 0;

    return {
      volatility: Number(currentVol.toFixed(6)),
      percentile: Number(percentile.toFixed(4)),
    };
  }

  /**
   * 为所有活跃指数计算并保存当日波动率
   */
  static async calculateAndSaveAll(): Promise<number> {
    const indices = await indexRepo().find({ where: { is_active: true } });
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;

    for (const idx of indices) {
      try {
        const existing = await historyRepo().findOne({
          where: { index_symbol: idx.index_symbol, calculation_date: today },
        });
        if (existing) continue;

        const computed = await this.calculateIndexVolatility(idx.index_symbol);
        if (computed.volatility <= 0) continue;

        const entity = historyRepo().create({
          index_symbol: idx.index_symbol,
          volatility: computed.volatility,
          percentile: computed.percentile,
          calculation_date: today,
          data_points: 252,
        });
        await historyRepo().save(entity);
        count++;
      } catch (e: any) {
        logger.error(`Failed to calculate volatility for ${idx.index_symbol}`, { error: e.message });
      }
    }

    return count;
  }
}
