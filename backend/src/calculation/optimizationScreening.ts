/**
 * [PRME-v1.3-PA-003] 收益优化建议细分 - 分目标筛选与评分
 * 文件: optimizationScreening.ts
 * 需求描述: Screen → Optimize → Explain 管线的筛选/评分/归一化核心
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §5/§6/§7/§8
 * 最后更新: 2026-09-06
 *
 * 核心原则：筛选决定"选哪些股票"，评分决定"为什么选它"，优化器决定"各配多少权重"。
 * score 不直接改写优化器输入（§7.2 二期可选增强，一期不启用）。
 */
import { AppDataSource } from '../config/database';
import { Stock } from '../models/Stock';
import { StockDailyBasic } from '../models/StockDailyBasic';
import { FinancialData } from '../models/FinancialData';
import { Holding } from '../models/Holding';
import { MarketDataService } from '../services/marketData.service';
import { mean, stdDev } from './utils';
import { calculateMaxDrawdown } from './risk';
import logger from '../utils/logger';

const stockRepo = () => AppDataSource.getRepository(Stock);
const dailyBasicRepo = () => AppDataSource.getRepository(StockDailyBasic);
const financialRepo = () => AppDataSource.getRepository(FinancialData);

export const SCREENING_OBJECTIVES = ['return_high_yield', 'return_growth', 'return_value', 'return_dividend'] as const;
export type ScreeningObjective = typeof SCREENING_OBJECTIVES[number];

export const OBJECTIVE_METHOD_MAIN: Record<ScreeningObjective, string> = {
  return_high_yield: 'maximum_sharpe',
  return_growth: 'mean_variance',
  return_value: 'mean_variance',
  return_dividend: 'mean_variance',
};

const MAX_POOL_SIZE = 200;
const MAX_PER_INDUSTRY = 30;
const RISK_FREE_RATE = 0.025;

export interface CandidateInfo {
  symbol: string;
  name: string;
  industry: string | null;
  is_holding: boolean;
  // 估值快照（最新交易日）
  pe_ttm: number | null;
  pb: number | null;
  total_mv: number | null;
  turnover_rate: number | null;
  // 价格衍生
  period_return: number | null;   // 近 252 交易日累计收益
  annual_return: number | null;   // 年化收益（日收益均值 × 252）
  sharpe: number | null;          // (年化 - 无风险利率) / 年化波动
  // 基本面
  revenue_growth: number | null;  // 营收同比（小数）
  profit_growth: number | null;   // 净利润同比（小数）
  dv_by_year: { year: number; dv_ratio: number }[];  // 近 3 个自然年（每年最新快照）
  // 评分输出
  score: number | null;
  reason: string | null;
}

export type DegradeReason = 'FUNDAMENTAL_DATA_UNAVAILABLE' | 'SCREENED_POOL_TOO_SMALL';

export interface ScreeningOutcome {
  applied: boolean;
  objective: ScreeningObjective;
  universe_size: number;   // 候选池规模（含持仓保留）
  passed_count: number;    // 硬筛选 + 评分通过（可出建议）数量
  degraded: boolean;
  reason: DegradeReason | null;
  pool: CandidateInfo[];   // 入选池（含全部持仓；持仓未过筛仍保留、score=null）
  scores: Map<string, number>;  // symbol → score（仅过筛且有评分者）
}

// ────────────────────────── 纯函数：分位数 / 评分 ──────────────────────────

/**
 * 池内分位：favorable（越大越好）用 rank/n，升序指标用 (n − rank + 1)/n。
 * 返回 [0, 1]，最高者 = 1。
 */
export function percentileRanks(values: (number | null)[], ascending: boolean): Map<number, number> {
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter(x => x.v !== null && Number.isFinite(x.v as number)) as { v: number; i: number }[];
  const n = indexed.length;
  const result = new Map<number, number>();
  if (n === 0) return result;
  indexed.sort((a, b) => a.v - b.v);
  // 平均秩处理并列
  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && indexed[j + 1].v === indexed[k].v) j++;
    const avgRank = (k + 1 + j + 1) / 2; // 并列取平均秩（1-based）
    const pct = ascending ? (n - avgRank + 1) / n : avgRank / n;
    for (let m = k; m <= j; m++) result.set(indexed[m].i, pct);
    k = j + 1;
  }
  return result;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * §4.4 增长率口径：最新年报 revenue/net_profit 对上一完整年度同比；
 * 不足两份年报退回最近两季季报同比。同期 ≤ 0 时返回 null。
 */
export function computeGrowthRates(
  financials: Pick<FinancialData, 'report_period' | 'report_type' | 'revenue' | 'net_profit'>[]
): { revenue_growth: number | null; profit_growth: number | null } {
  const annual = financials
    .filter(f => f.report_type === 'annual' && /^\d{4}$/.test(f.report_period))
    .sort((a, b) => b.report_period.localeCompare(a.report_period));
  const quarterly = financials
    .filter(f => f.report_type === 'quarterly' && /^\d{4}Q[1-4]$/.test(f.report_period))
    .sort((a, b) => b.report_period.localeCompare(a.report_period));

  const yoy = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null || previous <= 0) return null;
    return (current - previous) / Math.abs(previous);
  };

  const pick = (rows: typeof annual, key: 'revenue' | 'net_profit') => {
    if (rows.length >= 2) {
      return yoy(rows[0][key] !== null ? Number(rows[0][key]) : null,
                 rows[1][key] !== null ? Number(rows[1][key]) : null);
    }
    return undefined; // 未决，继续退回
  };

  const revenueAnnual = pick(annual, 'revenue');
  const profitAnnual = pick(annual, 'net_profit');
  if (revenueAnnual !== undefined && profitAnnual !== undefined) {
    return { revenue_growth: revenueAnnual, profit_growth: profitAnnual };
  }
  if (quarterly.length >= 2) {
    return {
      revenue_growth: revenueAnnual !== undefined ? revenueAnnual
        : yoy(quarterly[0].revenue !== null ? Number(quarterly[0].revenue) : null,
              quarterly[1].revenue !== null ? Number(quarterly[1].revenue) : null),
      profit_growth: profitAnnual !== undefined ? profitAnnual
        : yoy(quarterly[0].net_profit !== null ? Number(quarterly[0].net_profit) : null,
              quarterly[1].net_profit !== null ? Number(quarterly[1].net_profit) : null),
    };
  }
  return {
    revenue_growth: revenueAnnual !== undefined ? revenueAnnual : null,
    profit_growth: profitAnnual !== undefined ? profitAnnual : null,
  };
}

// ────────────────────────── §6.1 硬筛选 ──────────────────────────

function industryMedians(pool: CandidateInfo[]): { pe: number | null; pb: number | null } {
  const validPe = pool.map(c => c.pe_ttm).filter((v): v is number => v !== null && v > 0);
  const validPb = pool.map(c => c.pb).filter((v): v is number => v !== null && Number.isFinite(v));
  return { pe: median(validPe), pb: median(validPb) };
}

function industryMedianFor(pool: CandidateInfo[], industry: string | null, field: 'pe_ttm' | 'pb'): number | null {
  const group = pool.filter(c => c.industry === industry);
  const sample = (group.length >= 5 ? group : pool)
    .map(c => c[field])
    .filter((v): v is number => v !== null && (field === 'pe_ttm' ? v > 0 : Number.isFinite(v)));
  return median(sample);
}

export interface HardScreenContext {
  objective: ScreeningObjective;
  pool: CandidateInfo[];
  relaxed: boolean;
}

/** 返回通过硬筛选的 symbol 集合（持仓不过筛也可被调用方保留，见 screen()） */
export function hardScreen(ctx: HardScreenContext): Set<string> {
  const { objective, pool, relaxed } = ctx;
  const passed = new Set<string>();

  if (objective === 'return_high_yield') {
    const threshold = relaxed ? 0.6 : 0.5;
    const withRet = pool.filter(c => c.period_return !== null && Number.isFinite(c.period_return as number));
    const cutoffIdx = Math.ceil(withRet.length * threshold) - 1;
    const sorted = [...withRet].sort((a, b) => (b.period_return as number) - (a.period_return as number));
    const cutoffValue: number | undefined = sorted.length ? (sorted[Math.max(0, cutoffIdx)]?.period_return ?? undefined) : undefined;
    for (const c of withRet) {
      if ((c.period_return as number) > 0 && cutoffValue !== undefined && (c.period_return as number) >= cutoffValue) {
        passed.add(c.symbol);
      }
    }
    return passed;
  }

  if (objective === 'return_growth') {
    const limit = relaxed ? 0.05 : 0.10;
    for (const c of pool) {
      const rev = c.revenue_growth;
      const prof = c.profit_growth;
      if ((rev !== null && rev > limit) || (prof !== null && prof > limit)) passed.add(c.symbol);
    }
    return passed;
  }

  if (objective === 'return_value') {
    const factor = relaxed ? 0.9 : 0.8;
    for (const c of pool) {
      if (c.pe_ttm === null || c.pe_ttm <= 0) continue;
      const medPe = industryMedianFor(pool, c.industry, 'pe_ttm');
      const medPb = industryMedianFor(pool, c.industry, 'pb');
      const pePass = medPe !== null && c.pe_ttm < medPe * factor;
      const pbPass = c.pb !== null && medPb !== null && c.pb < medPb * factor;
      if (pePass || pbPass) passed.add(c.symbol);
    }
    return passed;
  }

  // return_dividend（dv_ratio 单位为 %）
  const avgLimit = relaxed ? 1.5 : 2.0;
  for (const c of pool) {
    const years = c.dv_by_year;
    if (years.length < 2) continue;
    const payingYears = years.filter(y => y.dv_ratio > 0).length;
    const avg = years.reduce((s, y) => s + y.dv_ratio, 0) / years.length;
    if (payingYears >= 2 && avg > avgLimit) passed.add(c.symbol);
  }
  return passed;
}

// ────────────────────────── §6.2 评分 ──────────────────────────

/** 在过筛池上打分（原地写入 score/reason）。返回可出建议的 symbol → score。 */
export function scorePool(objective: ScreeningObjective, pool: CandidateInfo[]): Map<string, number> {
  const scores = new Map<string, number>();

  const pctTop = (p: number) => Math.max(1, Math.round((1 - p) * 100));

  if (objective === 'return_high_yield') {
    const retPct = percentileRanks(pool.map(c => c.annual_return), false);
    const sharpePct = percentileRanks(pool.map(c => c.sharpe), false);
    for (const c of pool) {
      const rp = retPct.get(pool.indexOf(c));
      const sp = sharpePct.get(pool.indexOf(c));
      if (rp === undefined && sp === undefined) continue;
      const wR = rp !== undefined ? 0.6 : 0;
      const wS = sp !== undefined ? 0.4 : 0;
      c.score = ((rp ?? 0) * wR + (sp ?? 0) * wS) / (wR + wS);
      const parts: string[] = [];
      if (rp !== undefined) parts.push(`近1年收益池内前${pctTop(rp)}%`);
      if (sp !== undefined) parts.push(`夏普比率前${pctTop(sp)}%`);
      c.reason = parts.join('，');
      scores.set(c.symbol, c.score);
    }
    return scores;
  }

  if (objective === 'return_growth') {
    const revPct = percentileRanks(pool.map(c => c.revenue_growth), false);
    const profPct = percentileRanks(pool.map(c => c.profit_growth), false);
    for (const c of pool) {
      const rp = revPct.get(pool.indexOf(c));
      const pp = profPct.get(pool.indexOf(c));
      // null 项由另一项双倍权重顶替；两者皆 null 剔除
      if (rp === undefined && pp === undefined) { c.score = null; c.reason = null; continue; }
      const wR = rp !== undefined ? (pp !== undefined ? 0.5 : 1.0) : 0;
      const wP = pp !== undefined ? (rp !== undefined ? 0.5 : 1.0) : 0;
      c.score = ((rp ?? 0) * wR + (pp ?? 0) * wP) / (wR + wP);
      const fmt = (g: number) => `${g >= 0 ? '+' : ''}${(g * 100).toFixed(1)}%`;
      const parts: string[] = [];
      if (rp !== undefined && c.revenue_growth !== null) parts.push(`营收同比${fmt(c.revenue_growth)}（池内前${pctTop(rp)}%）`);
      if (pp !== undefined && c.profit_growth !== null) parts.push(`净利润同比${fmt(c.profit_growth)}（前${pctTop(pp)}%）`);
      c.reason = parts.join('，') || null;
      if (c.reason) scores.set(c.symbol, c.score);
    }
    return scores;
  }

  if (objective === 'return_value') {
    const invPe = pool.map(c => (c.pe_ttm !== null && c.pe_ttm > 0 ? 1 / c.pe_ttm : null));
    const invPb = pool.map(c => (c.pb !== null && c.pb > 0 ? 1 / c.pb : null));
    const pePct = percentileRanks(invPe, false);
    const pbPct = percentileRanks(invPb, false);
    for (const c of pool) {
      const pp = pePct.get(pool.indexOf(c));
      const bp = pbPct.get(pool.indexOf(c));
      if (pp === undefined && bp === undefined) { c.score = null; c.reason = null; continue; }
      const wP = pp !== undefined ? (bp !== undefined ? 0.5 : 1.0) : 0;
      const wB = bp !== undefined ? (pp !== undefined ? 0.5 : 1.0) : 0;
      c.score = ((pp ?? 0) * wP + (bp ?? 0) * wB) / (wP + wB);
      const parts: string[] = [];
      if (c.pe_ttm !== null && c.pe_ttm > 0) parts.push(`PE(TTM) ${c.pe_ttm.toFixed(1)}`);
      if (c.pb !== null) parts.push(`PB ${c.pb.toFixed(2)}${bp !== undefined ? `，池内前${pctTop(bp)}%` : ''}`);
      c.reason = parts.join('；') || null;
      if (c.reason) scores.set(c.symbol, c.score);
    }
    return scores;
  }

  // return_dividend
  const avgDv = pool.map(c =>
    c.dv_by_year.length ? c.dv_by_year.reduce((s, y) => s + y.dv_ratio, 0) / c.dv_by_year.length : null);
  const dvPct = percentileRanks(avgDv, false);
  for (const c of pool) {
    const dp = dvPct.get(pool.indexOf(c));
    if (dp === undefined || !c.dv_by_year.length) { c.score = null; c.reason = null; continue; }
    // TASK-2（2026-09-17 Kernel 拍板，方案 B）：持续性评分分母 = 该票实际有快照的年份数，
    // 与硬筛选“有快照年份 ≥2 年分红”口径一致；无快照年份不参与分母。
    const continuity = c.dv_by_year.filter(y => y.dv_ratio > 0).length / c.dv_by_year.length;
    c.score = 0.6 * dp + 0.4 * continuity;
    const avg = c.dv_by_year.reduce((s, y) => s + y.dv_ratio, 0) / c.dv_by_year.length;
    c.reason = `近3年平均股息率${avg.toFixed(1)}%（池内前${pctTop(dp)}%），连续${c.dv_by_year.filter(y => y.dv_ratio > 0).length}年分红`;
    scores.set(c.symbol, c.score);
  }
  return scores;
}

// ────────────────────────── §6.3 权重投影截断 + 归一化 ──────────────────────────

export interface WeightLimits {
  max_single: number;
  max_sector: number;
}

export const OBJECTIVE_WEIGHT_LIMITS: Record<ScreeningObjective, WeightLimits> = {
  return_high_yield: { max_single: 0.20, max_sector: 0.40 },
  return_growth: { max_single: 0.15, max_sector: 0.35 },
  return_value: { max_single: 0.15, max_sector: 0.35 },
  return_dividend: { max_single: 0.15, max_sector: 0.35 },
};

/**
 * 优化出权重后对超限项做投影截断 + 水填充再分配（§6.3）。
 * 单票/行业超限时，将超出部分按剩余额度（headroom）比例分配给其他个股；
 * 约束可行（行业数 × 行业上限 ≥ 1 且 单票上限 × 票数 ≥ 1）时严格满足约束且总和 = 1；
 * 不可行时按统一比例缩放回 1（此时约束按比例放松，属数学必然）。
 */
export function normalizeWeights(
  weights: Record<string, number>,
  industryOf: (symbol: string) => string | null,
  limits: WeightLimits
): Record<string, number> {
  const w: Record<string, number> = { ...weights };
  const positive = Object.keys(w).filter(s => w[s] > 0);
  if (!positive.length) return w;

  const sectorOf = (s: string) => industryOf(s) ?? '__unknown__';

  // 初始归一化
  const initialTotal = positive.reduce((sum, s) => sum + w[s], 0);
  if (initialTotal > 0) {
    for (const s of positive) w[s] = w[s] / initialTotal;
  }

  for (let round = 0; round < 20; round++) {
    let excess = 0;
    let clamped = false;
    // 1) 单票上限截断
    for (const s of positive) {
      if (w[s] > limits.max_single) {
        excess += w[s] - limits.max_single;
        w[s] = limits.max_single;
        clamped = true;
      }
    }
    // 2) 行业上限截断（按比例收缩超限行业）
    const sectorSum = new Map<string, number>();
    for (const s of positive) sectorSum.set(sectorOf(s), (sectorSum.get(sectorOf(s)) || 0) + w[s]);
    for (const [sector, sum] of sectorSum) {
      if (sum > limits.max_sector && sum > 0) {
        const scale = limits.max_sector / sum;
        for (const s of positive) {
          if (sectorOf(s) === sector) w[s] *= scale;
        }
        excess += sum - limits.max_sector;
        clamped = true;
      }
    }
    if (!clamped) break;
    // 3) 水填充：超出部分按剩余额度比例再分配
    const newSector = new Map<string, number>();
    for (const s of positive) newSector.set(sectorOf(s), (newSector.get(sectorOf(s)) || 0) + w[s]);
    const headroom = positive.map(s => Math.max(0, Math.min(
      limits.max_single - w[s],
      limits.max_sector - (newSector.get(sectorOf(s)) || 0)
    )));
    const totalHeadroom = headroom.reduce((a, b) => a + b, 0);
    if (totalHeadroom <= 0) break;
    const add = Math.min(excess, totalHeadroom);
    positive.forEach((s, i) => {
      w[s] += add * (headroom[i] / totalHeadroom);
    });
  }

  // 不可行情形的兜底：统一缩放回总和 1
  const finalTotal = positive.reduce((sum, s) => sum + w[s], 0);
  if (Math.abs(finalTotal - 1) > 1e-9 && finalTotal > 0) {
    for (const s of positive) w[s] = w[s] / finalTotal;
  }
  return w;
}

// ────────────────────────── §7.3 回测 ──────────────────────────

export interface BacktestLeg {
  cumulative_return: number;
  annual_return: number;
  volatility: number;
  max_drawdown: number;
  sharpe: number;
}

export interface BacktestResult {
  period: string;
  trading_days: number;
  current: BacktestLeg;
  optimized: BacktestLeg;
  disclaimer: string;
}

function legFromReturns(daily: number[]): BacktestLeg {
  if (!daily.length) {
    return { cumulative_return: 0, annual_return: 0, volatility: 0, max_drawdown: 0, sharpe: 0 };
  }
  const cumulative = daily.reduce((c, r) => c * (1 + r), 1) - 1;
  const annual = mean(daily) * 252;
  const vol = stdDev(daily) * Math.sqrt(252);
  return {
    cumulative_return: Number(cumulative.toFixed(4)),
    annual_return: Number(annual.toFixed(4)),
    volatility: Number(vol.toFixed(4)),
    max_drawdown: Number(calculateMaxDrawdown(daily).toFixed(4)),
    sharpe: Number((vol > 0 ? (annual - RISK_FREE_RATE) / vol : 0).toFixed(4)),
  };
}

/** 基于收益矩阵重采样当前权重与建议权重两条净值曲线 */
export function computeBacktest(
  matrix: number[][],
  symbols: string[],
  currentWeights: Record<string, number>,
  optimizedWeights: Record<string, number>
): BacktestResult {
  const idx = new Map(symbols.map((s, i) => [s, i]));
  const dailyFor = (weights: Record<string, number>) =>
    matrix.map(row => {
      let r = 0;
      for (const [sym, w] of Object.entries(weights)) {
        const i = idx.get(sym);
        if (i !== undefined && w > 0) r += w * (row[i] || 0);
      }
      return r;
    });

  return {
    period: '1y',
    trading_days: matrix.length,
    current: legFromReturns(dailyFor(currentWeights)),
    optimized: legFromReturns(dailyFor(optimizedWeights)),
    disclaimer: '历史表现不代表未来收益',
  };
}

// ────────────────────────── §5 候选池构建与数据装配 ──────────────────────────

const toNum = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
const toDateStr = (v: any): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

export class OptimizationScreening {
  /**
   * §5 候选池：用户持仓（全部保留）∪ 同行业股票（每行业最多 30，按 total_mv 降序），上限 200。
   */
  static async buildCandidatePool(holdings: Holding[]): Promise<CandidateInfo[]> {
    const bySymbol = new Map<string, CandidateInfo>();

    // 1) 持仓全部保留
    const holdingSymbols = holdings.map(h => h.symbol);
    const heldStocks = holdingSymbols.length
      ? await stockRepo().find({ where: holdingSymbols.map(symbol => ({ symbol })) as any })
      : [];
    const heldStockMap = new Map(heldStocks.map(s => [s.symbol, s]));
    for (const h of holdings) {
      const stock = heldStockMap.get(h.symbol);
      bySymbol.set(h.symbol, {
        symbol: h.symbol,
        name: (h as any).name || stock?.name || h.symbol,
        industry: stock?.industry ?? null,
        is_holding: true,
        pe_ttm: null, pb: null, total_mv: null, turnover_rate: null,
        period_return: null, annual_return: null, sharpe: null,
        revenue_growth: null, profit_growth: null,
        dv_by_year: [],
        score: null, reason: null,
      });
    }

    // 2) 同行业补充
    const industries = [...new Set([...heldStockMap.values()].map(s => s.industry).filter(Boolean))] as string[];
    if (industries.length) {
      const peers = await stockRepo().createQueryBuilder('s')
        .where('s.industry IN (:...industries)', { industries })
        .andWhere('s.symbol NOT IN (:...held)', { held: holdingSymbols.length ? holdingSymbols : ['__none__'] })
        .getMany();
      const peerSymbols = peers.map(p => p.symbol);
      const latestMv = peerSymbols.length
        ? await this.latestSnapshotBySymbol(peerSymbols)
        : new Map<string, StockDailyBasic>();
      for (const industry of industries) {
        const group = peers
          .filter(p => p.industry === industry)
          .map(p => ({ stock: p, mv: toNum(latestMv.get(p.symbol)?.total_mv) ?? toNum(p.market_cap) ?? 0 }))
          .sort((a, b) => b.mv - a.mv)
          .slice(0, MAX_PER_INDUSTRY);
        for (const { stock } of group) {
          if (!bySymbol.has(stock.symbol)) {
            bySymbol.set(stock.symbol, {
              symbol: stock.symbol,
              name: stock.name,
              industry: stock.industry,
              is_holding: false,
              pe_ttm: null, pb: null, total_mv: null, turnover_rate: null,
              period_return: null, annual_return: null, sharpe: null,
              revenue_growth: null, profit_growth: null,
              dv_by_year: [],
              score: null, reason: null,
            });
          }
        }
      }
    }

    // 3) 上限 200，按 total_mv 降序截断（持仓不占名额被裁掉）
    let pool = [...bySymbol.values()];
    if (pool.length > MAX_POOL_SIZE) {
      const mvBySymbol = await this.latestMvMap(pool.map(c => c.symbol));
      pool.sort((a, b) => {
        if (a.is_holding !== b.is_holding) return a.is_holding ? -1 : 1;
        return (mvBySymbol.get(b.symbol) ?? 0) - (mvBySymbol.get(a.symbol) ?? 0);
      });
      pool = pool.slice(0, MAX_POOL_SIZE);
    }
    return pool;
  }

  private static async latestSnapshotBySymbol(symbols: string[]): Promise<Map<string, StockDailyBasic>> {
    if (!symbols.length) return new Map();
    const rows: StockDailyBasic[] = await dailyBasicRepo().query(`
      SELECT sdb.* FROM stock_daily_basic sdb
      INNER JOIN (
        SELECT symbol, MAX(trade_date) AS max_d
        FROM stock_daily_basic
        WHERE symbol IN (${symbols.map(() => '?').join(',')})
        GROUP BY symbol
      ) t ON sdb.symbol = t.symbol AND sdb.trade_date = t.max_d
    `, symbols);
    const map = new Map<string, StockDailyBasic>();
    for (const r of rows) {
      map.set(r.symbol, Array.isArray(r) ? r[0] : r);
    }
    return map;
  }

  private static async latestMvMap(symbols: string[]): Promise<Map<string, number>> {
    const snapshots = await this.latestSnapshotBySymbol(symbols);
    const map = new Map<string, number>();
    for (const [sym, snap] of snapshots) {
      const mv = toNum((snap as any).total_mv);
      if (mv !== null) map.set(sym, mv);
    }
    return map;
  }

  /** 估值快照 + 股息历史（近 3 个自然年，每年最新一条） */
  static async enrichFundamentals(pool: CandidateInfo[]): Promise<void> {
    const symbols = pool.map(c => c.symbol);
    if (!symbols.length) return;
    const latest = await this.latestSnapshotBySymbol(symbols);
    for (const c of pool) {
      const snap = latest.get(c.symbol) as any;
      if (!snap) continue;
      c.pe_ttm = toNum(snap.pe_ttm);
      c.pb = toNum(snap.pb);
      c.total_mv = toNum(snap.total_mv);
      c.turnover_rate = toNum(snap.turnover_rate);
    }

    // 股息历史：近 3 个自然年，每年最新交易日快照
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2;
    const dvRows: any[] = await dailyBasicRepo().query(`
      SELECT symbol, strftime('%Y', trade_date) AS year, MAX(trade_date) AS max_d
      FROM stock_daily_basic
      WHERE symbol IN (${symbols.map(() => '?').join(',')})
        AND CAST(strftime('%Y', trade_date) AS INTEGER) >= ?
      GROUP BY symbol, year
    `, [...symbols, startYear]).catch(async (e) => {
      logger.warn('按年份提取股息历史失败', { error: e.message });
      return [];
    });
    const yearLatest = new Map<string, string>();
    for (const r of dvRows) {
      const row = Array.isArray(r) ? r[0] : r;
      yearLatest.set(`${row.symbol}|${row.year}`, toDateStr(row.max_d));
    }
    const detailRows: any[] = await dailyBasicRepo().query(`
      SELECT symbol, trade_date, dv_ratio FROM stock_daily_basic
      WHERE symbol IN (${symbols.map(() => '?').join(',')})
        AND CAST(strftime('%Y', trade_date) AS INTEGER) >= ?
    `, [...symbols, startYear]).catch(() => [] as any[]);
    const bySymbolYear = new Map<string, number>();
    for (const r of detailRows) {
      const row = Array.isArray(r) ? r[0] : r;
      const year = toDateStr(row.trade_date).slice(0, 4);
      const key = `${row.symbol}|${year}`;
      if (yearLatest.get(key) === toDateStr(row.trade_date)) {
        bySymbolYear.set(key, toNum(row.dv_ratio) ?? 0);
      }
    }
    for (const c of pool) {
      c.dv_by_year = [];
      for (let y = startYear; y <= currentYear; y++) {
        const dv = bySymbolYear.get(`${c.symbol}|${y}`);
        if (dv !== undefined) c.dv_by_year.push({ year: y, dv_ratio: dv });
      }
    }
  }

  /** 财务增长率（§4.4 口径） */
  static async enrichGrowth(pool: CandidateInfo[]): Promise<void> {
    const symbols = pool.map(c => c.symbol);
    if (!symbols.length) return;
    const stocks = await stockRepo().find({ where: symbols.map(symbol => ({ symbol })) as any });
    const stockIds = stocks.map(s => s.stock_id);
    if (!stockIds.length) return;
    const financials = await financialRepo().find({ where: stockIds.map(stock_id => ({ stock_id })) as any });
    const byStock = new Map<string, typeof financials>();
    for (const f of financials) {
      const list = byStock.get(f.stock_id) || [];
      list.push(f);
      byStock.set(f.stock_id, list);
    }
    const stockBySymbol = new Map(stocks.map(s => [s.symbol, s]));
    for (const c of pool) {
      const stock = stockBySymbol.get(c.symbol);
      const rows = stock ? byStock.get(stock.stock_id) : undefined;
      if (!rows || !rows.length) continue;
      const g = computeGrowthRates(rows);
      c.revenue_growth = g.revenue_growth;
      c.profit_growth = g.profit_growth;
    }
  }

  /** 价格衍生指标（mock 降级由 MarketDataService 内部处理） */
  static async enrichPrices(pool: CandidateInfo[]): Promise<void> {
    for (const c of pool) {
      try {
        const history = await MarketDataService.getHistory(c.symbol, 253);
        const prices = history.map(h => parseFloat((h as any).close_price?.toString() || '0')).reverse();
        if (prices.length < 2) continue;
        const rets: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        c.period_return = prices[prices.length - 1] / prices[0] - 1;
        c.annual_return = mean(rets) * 252;
        const vol = stdDev(rets) * Math.sqrt(252);
        c.sharpe = vol > 0 ? (c.annual_return - RISK_FREE_RATE) / vol : 0;
      } catch (e: any) {
        logger.warn('enrichPrices failed', { symbol: c.symbol, error: e.message });
      }
    }
  }

  /** 基本面覆盖率：拥有估值快照 / 财务数据 / 股息历史任一的候选占比 */
  static fundamentalCoverage(pool: CandidateInfo[]): number {
    if (!pool.length) return 0;
    const covered = pool.filter(c =>
      c.pe_ttm !== null || c.revenue_growth !== null || c.dv_by_year.length > 0
    ).length;
    return covered / pool.length;
  }

  /**
   * 主入口：完整筛选管线（§3）。
   * 返回入选池与降级信息；降级时 applied=false。
   */
  static async screen(
    holdings: Holding[],
    objective: ScreeningObjective
  ): Promise<ScreeningOutcome> {
    const pool = await this.buildCandidatePool(holdings);
    const universeSize = pool.length;

    const empty: ScreeningOutcome = {
      applied: false, objective, universe_size: universeSize, passed_count: 0,
      degraded: true, reason: 'FUNDAMENTAL_DATA_UNAVAILABLE', pool, scores: new Map(),
    };
    if (!pool.length) return empty;

    await this.enrichFundamentals(pool);
    await this.enrichGrowth(pool);

    // §8 降级触发：基本面覆盖率 < 50%
    if (!process.env.TUSHARE_TOKEN || this.fundamentalCoverage(pool) < 0.5) {
      return { ...empty };
    }

    // 流动性过滤：长期停牌（turnover 为 0 或 null）剔除非持仓候选
    const liquid = pool.filter(c => c.is_holding || (c.turnover_rate !== null && c.turnover_rate > 0));

    await this.enrichPrices(liquid);

    const base = {
      applied: true, objective, universe_size: universeSize, degraded: false, reason: null as DegradeReason | null,
    };

    // §6.1 硬筛选（先严格，池 <3 放宽一级）
    let passed = hardScreen({ objective, pool: liquid, relaxed: false });
    if (passed.size < 3) {
      passed = hardScreen({ objective, pool: liquid, relaxed: true });
    }
    if (passed.size < 3) {
      return { ...base, applied: false, degraded: true, reason: 'SCREENED_POOL_TOO_SMALL', passed_count: passed.size, pool, scores: new Map() };
    }

    const screenedPool = liquid.filter(c => passed.has(c.symbol));
    const scores = scorePool(objective, screenedPool);

    return { ...base, passed_count: scores.size, pool, scores };
  }
}
