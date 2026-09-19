/**
 * [PRME-v1.3.2-V2-04] VaR 回测（VAR-002 补全）
 * 文件: varBacktest.service.ts
 * 需求描述: 基于日度快照的一日 VaR 回测（as-of 配对 + Kupiec POF），
 *           与 PA-003 组合收益回测严格区分（风险模型准确性验证）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §7
 * 日期: 2026-09-19
 */
import { AppDataSource } from '../config/database';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot';
import { VaRCalculation } from '../models/VaRCalculation';
import { Portfolio } from '../models/Portfolio';
import logger from '../utils/logger';

const snapshotRepo = () => AppDataSource.getRepository(PortfolioSnapshot);
const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

export type BacktestVerdict = 'pass' | 'underestimate' | 'overestimate' | 'insufficient_data';

export interface BacktestException {
  date: string;
  var_percentage: number;
  actual_return: number;
  loss_multiple: number;
}

const VALID_WINDOWS = [90, 180, 365];

/** chi2(1) survival function：p_value = erfc(√(LR/2))（LR≤0 时取 1） */
export function chi2Survival1(lr: number): number {
  if (lr <= 0) return 1;
  return Math.min(1, Math.max(0, erfcApprox(Math.sqrt(lr / 2))));
}

/** erfc 近似（Abramowitz & Stegun 7.1.26，|ε|≤1.5e-7） */
export function erfcApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  const erf = sign * y;
  return 1 - erf;
}

/**
 * Kupiec POF 统计量：
 * LR = -2 · ln[ p^x(1-p)^(n-x) / (phat^x(1-phat)^(n-x)) ]（x=0 或 x=n 时取极限式，ln 项按 0 处理）
 */
export function kupiecLR(n: number, x: number, p: number): number {
  const phat = n > 0 ? x / n : 0;
  const term = (prob: number, k: number) =>
    k === 0 ? 0 : k * Math.log(Math.max(prob, 1e-15));
  const llAlt = term(phat, x) + term(1 - phat, n - x);
  const llNull = term(p, x) + term(1 - p, n - x);
  return Math.max(0, -2 * (llNull - llAlt));
}

export class VarBacktestService {
  /**
   * 执行 VaR 回测（on-the-fly，不落库不缓存）。
   * 配对规则（as-of）：快照日 D 的日收益 r_D 对「calculated_at 日期 < D」的最新一条 VaR
   * （同 portfolio；time_horizon 多条优先 =1，其次最新 calculated_at；var_percentage NULL 跳过）。
   * 严格大于才 exceed（恰等于 VaR 边界不算）。
   */
  static async runBacktest(portfolioId: string, userId: string, windowDays = 180) {
    if (!VALID_WINDOWS.includes(windowDays)) {
      throw Object.assign(
        new Error(`window_days 必须是 ${VALID_WINDOWS.join('/')} 之一`),
        { statusCode: 400 }
      );
    }

    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: userId } });
    if (!portfolio) {
      throw Object.assign(new Error('Portfolio not found'), { statusCode: 404 });
    }

    // 窗口内快照（有日收益）
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const snapshots = await snapshotRepo()
      .createQueryBuilder('s')
      .where('s.portfolio_id = :portfolioId', { portfolioId })
      .andWhere('s.daily_return IS NOT NULL')
      .andWhere('s.snapshot_date >= :since', { since: since.toISOString().slice(0, 10) })
      .orderBy('s.snapshot_date', 'ASC')
      .getMany();

    // 该组合全部 VaR 记录（按日期升序，用于 as-of 二分查找）
    const varRows = await varRepo()
      .createQueryBuilder('v')
      .where('v.portfolio_id = :portfolioId', { portfolioId })
      .andWhere('v.var_percentage IS NOT NULL')
      .orderBy('v.calculated_at', 'ASC')
      .getMany();
    const varByDate = new Map<string, { var_percentage: number; confidence_level: number }>();
    for (const v of varRows) {
      if (!v.calculated_at) continue;
      const d = new Date(v.calculated_at).toISOString().slice(0, 10);
      // 同日多条：优先 time_horizon=1，其次后算者覆盖（ASC 顺序后者覆盖前者）
      const existing = varByDate.get(d);
      if (!existing || v.time_horizon === 1) {
        varByDate.set(d, { var_percentage: Number(v.var_percentage!), confidence_level: Number(v.confidence_level) });
      }
    }
    const varDates = [...varByDate.keys()].sort();

    // as-of 查找：严格早于 D 的最新日期（二分）
    const findAsOf = (dateStr: string): { var_percentage: number; confidence_level: number } | null => {
      let lo = 0, hi = varDates.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (varDates[mid] < dateStr) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return ans >= 0 ? varByDate.get(varDates[ans])! : null;
    };

    let n = 0;
    let x = 0;
    let pSum = 0;
    let confidence = 0.95;
    const exceptions: BacktestException[] = [];

    for (const s of snapshots) {
      const d = new Date(s.snapshot_date).toISOString().slice(0, 10);
      const asOf = findAsOf(d);
      if (!asOf) continue; // 无匹配 VaR → 跳过，不计入分母

      const r = Number(s.daily_return);
      const varPct = asOf.var_percentage;
      n++;
      pSum += 1 - asOf.confidence_level;
      if (n === 1) confidence = asOf.confidence_level;

      if (-r > varPct) {
        x++;
        exceptions.push({
          date: d,
          var_percentage: varPct,
          actual_return: r,
          loss_multiple: parseFloat((-r / varPct).toFixed(4)),
        });
      }
    }

    const expectedFrequency = n > 0 ? pSum / n : 0;
    const coverage = n > 0 ? x / n : 0;

    if (n < 30) {
      return {
        success: true,
        portfolio_id: portfolioId,
        window_days: windowDays,
        confidence_level: confidence,
        samples: n,
        exceedances: x,
        coverage: parseFloat(coverage.toFixed(4)),
        expected_frequency: parseFloat(expectedFrequency.toFixed(4)),
        kupiec: {
          lr_statistic: null,
          p_value: null,
          verdict: 'insufficient_data' as BacktestVerdict,
          message: n === 0
            ? '窗口内没有可用的 VaR-快照配对样本（请先运行 VaR 计算并等待日度快照积累）'
            : `有效样本 ${n} 个，少于 30 个统计下限，暂不能给出覆盖率结论`,
        },
        exceptions: exceptions
          .sort((a, b) => b.loss_multiple - a.loss_multiple)
          .slice(0, 10),
        generated_at: new Date().toISOString(),
      };
    }

    const p = expectedFrequency; // 样本各自的预期违约频率均值
    const lr = kupiecLR(n, x, p);
    const pValue = chi2Survival1(lr);

    let verdict: BacktestVerdict;
    if (pValue >= 0.05) verdict = 'pass';
    else if (coverage > p) verdict = 'underestimate';
    else verdict = 'overestimate';

    return {
      success: true,
      portfolio_id: portfolioId,
      window_days: windowDays,
      confidence_level: confidence,
      samples: n,
      exceedances: x,
      coverage: parseFloat(coverage.toFixed(4)),
      expected_frequency: parseFloat(p.toFixed(4)),
      kupiec: {
        lr_statistic: parseFloat(lr.toFixed(6)),
        p_value: parseFloat(pValue.toFixed(6)),
        verdict,
        message: verdict === 'underestimate'
          ? '模型低估风险（实际损失超 VaR 频率偏高），建议提高置信水平或缩短再评估周期'
          : verdict === 'overestimate'
            ? '模型高估风险（实际损失超 VaR 频率偏低），偏保守'
            : '模型通过 Kupiec POF 检验，预测准确性在统计可接受范围内',
      },
      exceptions: exceptions
        .sort((a, b) => b.loss_multiple - a.loss_multiple)
        .slice(0, 10),
      generated_at: new Date().toISOString(),
    };
  }
}
