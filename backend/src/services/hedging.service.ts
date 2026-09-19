/**
 * [PRME-v1.3.2-V2-06] 风险对冲建议（RM-003 方案 A）
 * 文件: hedging.service.ts
 * 需求描述: 输入组合 → 输出对冲需求评估 + 教育性建议动作清单（不含交易指令）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §6.2
 * 可行性依据: PRME-RM003-Hedging-Feasibility-Assessment-20260919.md（方案 A）
 * 日期: 2026-09-19
 */
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { VaRCalculation } from '../models/VaRCalculation';
import { MarketData } from '../models/MarketData';
import { MarketVolatilityIndex } from '../models/MarketVolatilityIndex';
import { MarketVolatilityHistory } from '../models/MarketVolatilityHistory';
import { PortfolioService } from './portfolio.service';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const marketDataRepo = () => AppDataSource.getRepository(MarketData);
const indexRepo = () => AppDataSource.getRepository(MarketVolatilityIndex);
const historyRepo = () => AppDataSource.getRepository(MarketVolatilityHistory);

const DISCLAIMER = '以上为风险教育性建议，不构成投资建议。市场有风险，投资需谨慎。';

/** 用户风险等级对应的 VaR% 上限（设计 §6.2） */
const RISK_LEVEL_VAR_CAP: Record<string, number> = { low: 0.05, medium: 0.10, high: 0.15 };

/** 线性插值分位数（sorted 升序数组，q ∈ [0,1]） */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0);
}

/** Pearson 相关系数（两序列等长且 ≥ 2 个样本；方差为 0 时返回 0） */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

export class HedgingService {
  /**
   * 生成组合对冲建议（on-the-fly，不落库）。
   * 降级：组合不存在/非属主 403 由 controller 处理；VaR 数据缺失时 needs_hedging=false + advice 空 + 提示。
   */
  static async getAdvice(portfolioId: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: userId } });
    if (!portfolio) {
      throw Object.assign(new Error('Portfolio not found'), { statusCode: 404 });
    }

    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId, status: 'active' } });

    // ── 组合条件：最新 VaR% > 近 90 日 VaR% 的 80 分位 ──
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const varRows = await varRepo()
      .createQueryBuilder('v')
      .where('v.portfolio_id = :portfolioId', { portfolioId })
      .andWhere('v.calculated_at >= :since', { since: since.toISOString() })
      .andWhere('v.var_percentage IS NOT NULL')
      .orderBy('v.calculated_at', 'ASC')
      .getMany();

    if (varRows.length === 0) {
      // VaR 缺失降级
      return {
        portfolio_id: portfolioId,
        needs_hedging: false,
        triggers: [] as string[],
        advice: [] as any[],
        disclaimer: DISCLAIMER,
        note: '组合暂无可用的 VaR 历史数据，无法评估对冲需求。请先运行 VaR 计算后再试。',
        generated_at: new Date().toISOString(),
      };
    }

    const varValues = varRows.map(r => Number(r.var_percentage));
    const latestVar = varValues[varValues.length - 1];
    const p80 = quantile([...varValues].sort((a, b) => a - b), 0.8);
    const portfolioTriggered = latestVar > p80;

    // ── 市场条件：主指数最新波动率分位 ≥ 0.8 ──
    const marketTriggered = await this.isMarketVolatilityHigh();

    const triggers: string[] = [];
    if (portfolioTriggered) triggers.push('portfolio_var_high');
    if (marketTriggered) triggers.push('market_volatility_high');
    const needsHedging = triggers.length > 0;

    const advice: any[] = [];

    // 1. 仓位建议：needs_hedging 且 HHI > 0.3
    const totalValue = holdings.reduce((s, h) => s + Number(h.market_value?.toString() || 0), 0);
    if (needsHedging && totalValue > 0) {
      const hhi = PortfolioService.calculateHHI(holdings);
      if (hhi > 0.3) {
        const riskLevel = portfolio.risk_level || 'medium';
        const targetVar = RISK_LEVEL_VAR_CAP[riskLevel] ?? RISK_LEVEL_VAR_CAP.medium;
        const ratio = latestVar > 0 ? Math.min(1, targetVar / latestVar) : 1;
        const rounded = Math.min(1, Math.max(0.05, Math.round(ratio / 0.05) * 0.05));
        const lo = Math.max(0.05, rounded - 0.05);
        const hi = Math.min(1, rounded + 0.05);
        advice.push({
          type: 'position',
          summary: `建议将仓位降至当前水平的 ${(rounded * 100).toFixed(0)}% 左右（区间 ${(lo * 100).toFixed(0)}%~${(hi * 100).toFixed(0)}%）`,
          suggested_weight_range: [lo, hi],
          rationale: `当前 VaR ${(latestVar * 100).toFixed(2)}% 高于近 90 日 80 分位 ${(p80 * 100).toFixed(2)}%，且组合集中度 HHI=${hhi.toFixed(3)} 超过 0.3。按 ${riskLevel} 风险等级 VaR 上限 ${(targetVar * 100).toFixed(0)}% 反推建议仓位。`,
        });
      }
    }

    // 2. 行业再平衡：第一大行业权重 > 40% 且该行业近 20 日波动率池内高分位
    if (holdings.length > 0 && totalValue > 0) {
      const sectorAdvice = await this.buildSectorRebalanceAdvice(holdings, totalValue);
      if (sectorAdvice) advice.push(sectorAdvice);
    }

    // 3. 防御资产提示：needs_hedging 且市场条件触发
    if (needsHedging && marketTriggered) {
      advice.push({
        type: 'defensive_asset',
        summary: '可关注防御性资产类别：货币基金 / 短债基金 / 黄金 ETF',
        rationale: '当前市场波动率处于历史高分位环境，防御性资产类别通常与权益市场相关性较低，可用于缓冲组合波动（仅为类别教育性说明，不推荐具体产品）。',
      });
    }

    return {
      portfolio_id: portfolioId,
      needs_hedging: needsHedging,
      triggers,
      advice,
      disclaimer: DISCLAIMER,
      generated_at: new Date().toISOString(),
    };
  }

  /** 市场条件：权重最高的 active 指数最新分位 ≥ 0.8；percentile 缺失时用 volatility 自身近 252 日历史分位回退 */
  private static async isMarketVolatilityHigh(): Promise<boolean> {
    try {
      const mainIndex = await indexRepo().findOne({ where: { is_active: true }, order: { weight: 'DESC' } });
      if (!mainIndex) return false;

      const latest = await historyRepo().findOne({
        where: { index_symbol: mainIndex.index_symbol },
        order: { calculation_date: 'DESC' },
      });
      if (!latest) return false;

      if (latest.percentile !== null && latest.percentile !== undefined) {
        return Number(latest.percentile) >= 0.8;
      }

      // 回退：volatility 在近 252 日历史中的分位
      const rows = await historyRepo().find({
        where: { index_symbol: mainIndex.index_symbol },
        order: { calculation_date: 'DESC' },
        take: 252,
      });
      if (rows.length < 20) return false;
      const vols = rows.map(r => Number(r.volatility));
      const current = vols[0];
      const rank = vols.filter(v => v <= current).length / vols.length;
      return rank >= 0.8;
    } catch (e: any) {
      logger.warn('Market volatility check failed, treating as not triggered', { error: e.message });
      return false;
    }
  }

  /**
   * 行业再平衡建议：
   * 第一大行业权重 > 40% 且该行业近 20 日波动率在持仓行业池内分位 ≥ 0.8 →
   * 按 60 日日收益 Pearson 相关矩阵，找与该行业相关性最低的 2~3 个低配行业建议分散。
   * 数据不足返回 null（不生成该建议）。
   */
  private static async buildSectorRebalanceAdvice(holdings: Holding[], totalValue: number) {
    const sectorWeight = new Map<string, number>();
    const sectorSymbols = new Map<string, Set<string>>();
    for (const h of holdings) {
      const sector = h.sector || '未分类';
      const mv = Number(h.market_value?.toString() || 0);
      sectorWeight.set(sector, (sectorWeight.get(sector) || 0) + mv);
      if (!sectorSymbols.has(sector)) sectorSymbols.set(sector, new Set());
      sectorSymbols.get(sector)!.add(h.symbol);
    }

    // 第一大行业
    let topSector = '';
    let topWeight = 0;
    for (const [s, w] of sectorWeight) {
      if (w > topWeight) { topSector = s; topWeight = w; }
    }
    const topWeightRatio = totalValue > 0 ? topWeight / totalValue : 0;
    if (!topSector || topWeightRatio <= 0.4) return null;

    // 各行业近 20 日波动率（market_data 收盘价 → sector 等权日收益 std）
    const sectorReturnSeries = new Map<string, number[]>();
    for (const [sector, symbols] of sectorSymbols) {
      const series = await this.buildSectorReturnSeries([...symbols], 60);
      if (series && series.length >= 21) sectorReturnSeries.set(sector, series);
    }
    if (sectorReturnSeries.size < 2) return null;

    const sectorVol = new Map<string, number>();
    for (const [sector, series] of sectorReturnSeries) {
      const recent = series.slice(-20);
      sectorVol.set(sector, std(recent));
    }
    const topVol = sectorVol.get(topSector);
    if (topVol === undefined) return null;

    // 池内分位：该行业波动率 ≥ 池内 80% 的行业
    const vols = [...sectorVol.values()].sort((a, b) => a - b);
    const rank = vols.filter(v => v <= topVol).length / vols.length;
    if (rank < 0.8) return null;

    // 相关矩阵：topSector vs 其他低配行业（权重低于等权）
    const equalWeight = 1 / sectorWeight.size;
    const candidates: { sector: string; corr: number; weight: number }[] = [];
    const topSeries = sectorReturnSeries.get(topSector)!;
    for (const [sector, series] of sectorReturnSeries) {
      if (sector === topSector) continue;
      const w = sectorWeight.get(sector)! / totalValue;
      if (w >= equalWeight) continue; // 仅低配行业
      const overlap = Math.min(topSeries.length, series.length);
      candidates.push({ sector, corr: pearson(topSeries.slice(-overlap), series.slice(-overlap)), weight: w });
    }
    candidates.sort((a, b) => a.corr - b.corr);
    const picked = candidates.slice(0, 3);
    if (picked.length === 0) return null;

    return {
      type: 'sector_rebalance',
      summary: `行业「${topSector}」占组合 ${(topWeightRatio * 100).toFixed(1)}% 且近期波动处于行业池内高分位，建议将超配部分逐步分散至：${picked.map(p => p.sector).join('、')}`,
      rationale: `近 20 日行业波动率池内分位 ${(rank * 100).toFixed(0)}%（≥80% 阈值）；上述行业与「${topSector}」60 日日收益相关性最低（${picked.map(p => `${p.sector} r=${p.corr.toFixed(2)}`).join('，')}），分散效果相对更好。`,
    };
  }

  /** sector 等权日收益序列：组内各 symbol 日收益（market_data 收盘价，近 window+1 条）等权平均 */
  private static async buildSectorReturnSeries(symbols: string[], window: number): Promise<number[] | null> {
    try {
      const seriesBySymbol = new Map<string, number[]>();
      for (const symbol of symbols) {
        const rows = await marketDataRepo().find({
          where: { symbol },
          order: { trade_date: 'ASC' },
          take: window + 1,
        });
        if (rows.length < 22) continue;
        const closes = rows.map(r => Number(r.close_price)).filter(v => v > 0);
        if (closes.length < 22) continue;
        const rets: number[] = [];
        for (let i = 1; i < closes.length; i++) {
          rets.push(closes[i] / closes[i - 1] - 1);
        }
        seriesBySymbol.set(symbol, rets);
      }
      if (seriesBySymbol.size === 0) return null;

      // 等权平均（按最短序列截断）
      const minLen = Math.min(...[...seriesBySymbol.values()].map(s => s.length));
      const out: number[] = [];
      for (let i = 0; i < minLen; i++) {
        let sum = 0;
        for (const s of seriesBySymbol.values()) sum += s[s.length - minLen + i];
        out.push(sum / seriesBySymbol.size);
      }
      return out;
    } catch (e: any) {
      logger.warn('Sector return series build failed', { error: e.message });
      return null;
    }
  }
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1));
}
