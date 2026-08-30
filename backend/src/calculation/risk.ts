/**
 * [PRME-CALC-003] 风险指标计算模块
 * 文件: risk.ts
 * 需求描述: 实现夏普比率、最大回撤、索提诺比率、卡尔玛比率等风险指标
 * 最后更新: 2026-06-17
 */
import { mean, stdDev } from './utils';

export interface RiskMetrics {
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  sortino_ratio: number;
  calmar_ratio: number;
  skewness: number;
  kurtosis: number;
}

/**
 * 计算综合风险指标
 */
export function calculateRiskMetrics(returns: number[]): RiskMetrics {
  const std = stdDev(returns);
  const m = mean(returns);

  // 夏普比率
  let sharpeRatio: number;
  if (std !== 0) {
    sharpeRatio = (m / std) * Math.sqrt(252);
  } else if (m > 0) {
    sharpeRatio = Infinity;
  } else if (m < 0) {
    sharpeRatio = -Infinity;
  } else {
    sharpeRatio = 0;
  }

  return {
    volatility: std * Math.sqrt(252),
    sharpe_ratio: sharpeRatio,
    max_drawdown: calculateMaxDrawdown(returns),
    sortino_ratio: calculateSortinoRatio(returns),
    calmar_ratio: calculateCalmarRatio(returns),
    skewness: std !== 0 ? mean(returns.map(r => ((r - m) / std) ** 3)) : 0,
    kurtosis: std !== 0 ? mean(returns.map(r => ((r - m) / std) ** 4)) : 0,
  };
}

/**
 * 计算最大回撤
 */
export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  let cumulative = 1;
  let peak = 1;
  let maxDrawdown = 0;
  
  for (const r of returns) {
    cumulative *= (1 + r);
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = (cumulative - peak) / peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * 计算Sortino比率
 */
export function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
  const downsideReturns = returns.filter(r => r < 0);
  const downsideStd = downsideReturns.length > 0 ? stdDev(downsideReturns) : 0;
  if (downsideStd === 0) return 0;
  return ((mean(returns) - riskFreeRate / 252) / downsideStd) * Math.sqrt(252);
}

/**
 * 计算Calmar比率
 */
export function calculateCalmarRatio(returns: number[]): number {
  const maxDd = calculateMaxDrawdown(returns);
  if (maxDd === 0) return 0;
  return (mean(returns) * 252) / Math.abs(maxDd);
}

/**
 * 计算Beta
 */
export function calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
  if (portfolioReturns.length !== marketReturns.length || portfolioReturns.length === 0) return 0;
  const n = portfolioReturns.length;
  const meanP = mean(portfolioReturns);
  const meanM = mean(marketReturns);

  let cov = 0;
  let varM = 0;
  for (let i = 0; i < n; i++) {
    cov += (portfolioReturns[i] - meanP) * (marketReturns[i] - meanM);
    varM += Math.pow(marketReturns[i] - meanM, 2);
  }
  cov /= n;
  varM /= n;

  return varM !== 0 ? cov / varM : 0;
}

/**
 * 计算Treynor比率
 */
export function calculateTreynorRatio(portfolioReturns: number[], marketReturns: number[], riskFreeRate: number = 0.025): number {
  const beta = calculateBeta(portfolioReturns, marketReturns);
  if (beta === 0) return 0;
  return (mean(portfolioReturns) * 252 - riskFreeRate) / beta;
}

/**
 * 计算相关系数矩阵
 */
export function calculateCorrelationMatrix(
  symbols: string[],
  historicalReturns?: number[][]
): { symbols: string[]; matrix: number[][]; source: string; data_points: number } {
  const n = symbols.length;
  if (n === 0) {
    throw new Error('At least one symbol is required');
  }

  if (historicalReturns && historicalReturns.length > 0) {
    const returns = historicalReturns;
    if (returns[0].length === n) {
      const corr: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) {
          const colI = returns.map(r => r[i]);
          const colJ = returns.map(r => r[j]);
          const cov = calculateCovariance(colI, colJ);
          const stdI = stdDev(colI);
          const stdJ = stdDev(colJ);
          row.push(stdI > 0 && stdJ > 0 ? cov / (stdI * stdJ) : (i === j ? 1 : 0));
        }
        corr.push(row);
      }
      return { symbols, matrix: corr, source: 'calculated', data_points: returns.length };
    }
  }

  // Fallback: 估计相关矩阵
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(i === j ? 1.0 : 0.3);
    }
    matrix.push(row);
  }

  return { symbols, matrix, source: 'estimated', data_points: 0 };
}

function calculateCovariance(a: number[], b: number[]): number {
  const mA = mean(a);
  const mB = mean(b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - mA) * (b[i] - mB);
  }
  return sum / a.length;
}
