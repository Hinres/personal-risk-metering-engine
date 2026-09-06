/**
 * [PRME-CALC-006] 组合优化模块
 * 文件: optimization.ts
 * 需求描述: 实现风险平价/最小方差/最大夏普/均值方差四种优化方法
 * 最后更新: 2026-06-17
 */
import { mean, covarianceMatrix, matrixInverse, dotProduct } from './utils';

export interface OptimizationResult {
  method: string;
  weights: Record<string, number>;
  expected_return: number;
  expected_volatility: number;
  sharpe_ratio: number;
  risk_contributions?: Record<string, number>;
  scaled_weights?: Record<string, number>;
  scaled_volatility?: number;
  efficient_frontier?: Array<{
    target_return: number;
    achieved_return: number;
    volatility: number;
    sharpe: number;
  }>;
  optimal_portfolio?: {
    target_return: number;
    achieved_return: number;
    volatility: number;
    sharpe: number;
  } | null;
  error?: string;
}

/**
 * 风险平价优化
 */
export function riskParityOptimization(
  returns: number[][],
  covMatrix: number[][],
  symbols: string[],
  targetVolatility?: number | null
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) return { method: 'risk_parity', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'No assets provided' };

  const diagVols = covMatrix.map((row, i) => Math.sqrt(row[i]));
  const invVols = diagVols.map(v => v > 0 ? 1.0 / v : 0);
  const totalInv = invVols.reduce((a, b) => a + b, 0);
  
  let weights: number[];
  if (totalInv > 0 && isFinite(totalInv)) {
    weights = invVols.map(v => v / totalInv);
  } else {
    weights = Array(n).fill(1 / n);
  }

  const meanReturns = symbols.map((_, i) => mean(returns.map(r => r[i] || 0)));
  const portfolioReturn = dotProduct(weights, meanReturns);
  const portfolioVol = Math.sqrt(dotProduct(weights, covMatrix.map(row => dotProduct(row, weights))));

  const marginalRisk = covMatrix.map(row => dotProduct(row, weights));
  const riskContrib = weights.map((w, i) => portfolioVol > 0 ? w * marginalRisk[i] / portfolioVol : 0);

  const result: OptimizationResult = {
    method: 'risk_parity',
    weights: Object.fromEntries(symbols.map((s, i) => [s, Math.round(weights[i] * 10000) / 10000])),
    expected_return: Math.round(portfolioReturn * 1000000) / 1000000,
    expected_volatility: Math.round(portfolioVol * 1000000) / 1000000,
    sharpe_ratio: portfolioVol > 0 ? Math.round((portfolioReturn / portfolioVol) * 10000) / 10000 : 0,
    risk_contributions: Object.fromEntries(symbols.map((s, i) => [s, Math.round(riskContrib[i] * 10000) / 10000])),
  };

  if (targetVolatility && portfolioVol > 0) {
    const scale = targetVolatility / portfolioVol;
    const scaledWeights = weights.map(w => w * scale);
    result.scaled_weights = Object.fromEntries(symbols.map((s, i) => [s, Math.round(scaledWeights[i] * 10000) / 10000]));
    result.scaled_volatility = targetVolatility;
  }

  return result;
}

/**
 * 最小方差优化
 */
export function minimumVarianceOptimization(
  returns: number[][],
  covMatrix: number[][],
  symbols: string[],
  allowShort: boolean = false
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) return { method: 'minimum_variance', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'No assets provided' };

  try {
    // 添加正则化
    let regCov = covMatrix.map((row, i) => 
      row.map((val, j) => val + (i === j ? 1e-6 : 0))
    );

    // 检查条件数
    const cond = estimateConditionNumber(regCov);
    if (cond > 1e12) {
      regCov = covMatrix.map((row, i) => 
        row.map((val, j) => val + (i === j ? 1e-4 : 0))
      );
    } else if (cond > 1e8) {
      regCov = covMatrix.map((row, i) => 
        row.map((val, j) => val + (i === j ? 1e-5 : 0))
      );
    }

    const invCov = matrixInverse(regCov);
    const ones = Array(n).fill(1);
    
    const denominator = dotProduct(ones, invCov.map(row => dotProduct(row, ones)));
    let weights = invCov.map(row => dotProduct(row, ones) / denominator);

    if (!allowShort) {
      weights = weights.map(w => Math.max(w, 0));
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = sum > 0 ? weights.map(w => w / sum) : Array(n).fill(1 / n);
    }

    const meanReturns = symbols.map((_, i) => mean(returns.map(r => r[i] || 0)));
    const portfolioReturn = dotProduct(weights, meanReturns);
    const portfolioVol = Math.sqrt(dotProduct(weights, covMatrix.map(row => dotProduct(row, weights))));

    return {
      method: 'minimum_variance',
      weights: Object.fromEntries(symbols.map((s, i) => [s, Math.round(weights[i] * 10000) / 10000])),
      expected_return: Math.round(portfolioReturn * 1000000) / 1000000,
      expected_volatility: Math.round(portfolioVol * 1000000) / 1000000,
      sharpe_ratio: portfolioVol > 0 ? Math.round((portfolioReturn / portfolioVol) * 10000) / 10000 : 0,
    };
  } catch {
    return { method: 'minimum_variance', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'Covariance matrix is singular' };
  }
}

/**
 * 最大夏普比率优化
 */
export function maximumSharpeOptimization(
  returns: number[][],
  covMatrix: number[][],
  symbols: string[],
  riskFreeRate: number = 0.03,
  allowShort: boolean = false
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) return { method: 'maximum_sharpe', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'No assets provided' };

  try {
    const meanReturns = symbols.map((_, i) => mean(returns.map(r => r[i] || 0)));
    const excessReturns = meanReturns.map(mr => mr - riskFreeRate);

    const regCov = covMatrix.map((row, i) => 
      row.map((val, j) => val + (i === j ? 1e-6 : 0))
    );
    const invCov = matrixInverse(regCov);

    let weights = invCov.map(row => dotProduct(row, excessReturns));
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = sum !== 0 ? weights.map(w => w / sum) : Array(n).fill(1 / n);

    if (!allowShort) {
      weights = weights.map(w => Math.max(w, 0));
      const posSum = weights.reduce((a, b) => a + b, 0);
      weights = posSum > 0 ? weights.map(w => w / posSum) : Array(n).fill(1 / n);
    }

    const portfolioReturn = dotProduct(weights, meanReturns);
    const portfolioVol = Math.sqrt(dotProduct(weights, covMatrix.map(row => dotProduct(row, weights))));
    const sharpe = portfolioVol > 0 ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;

    return {
      method: 'maximum_sharpe',
      weights: Object.fromEntries(symbols.map((s, i) => [s, Math.round(weights[i] * 10000) / 10000])),
      expected_return: Math.round(portfolioReturn * 1000000) / 1000000,
      expected_volatility: Math.round(portfolioVol * 1000000) / 1000000,
      sharpe_ratio: Math.round(sharpe * 10000) / 10000,
    };
  } catch {
    return { method: 'maximum_sharpe', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'Covariance matrix is singular' };
  }
}

/**
 * 均值-方差优化 (Markowitz)
 */
export function meanVarianceOptimization(
  returns: number[][],
  covMatrix: number[][],
  symbols: string[],
  targetReturn?: number | null,
  targetVolatility?: number | null,
  riskFreeRate: number = 0.03
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) return { method: 'mean_variance', weights: {}, expected_return: 0, expected_volatility: 0, sharpe_ratio: 0, error: 'No assets provided' };

  const meanReturns = symbols.map((_, i) => mean(returns.map(r => r[i] || 0)));
  const minReturn = Math.min(...meanReturns);
  const maxReturn = Math.max(...meanReturns);

  const efficientFrontier: Array<{ target_return: number; achieved_return: number; volatility: number; sharpe: number }> = [];
  // PRME-v1.3-PA-003：记录每个前沿点的权重向量，最优点的权重随结果返回
  const frontierWeights: number[][] = [];

  const targetReturns = linspace(minReturn, maxReturn, 20);

  for (const tr of targetReturns) {
    try {
      const regCov = covMatrix.map((row, i) => 
        row.map((val, j) => val + (i === j ? 1e-6 : 0))
      );
      const invCov = matrixInverse(regCov);
      const ones = Array(n).fill(1);

      const a = dotProduct(ones, invCov.map(row => dotProduct(row, ones)));
      const b = dotProduct(ones, invCov.map(row => dotProduct(row, meanReturns)));
      const c = dotProduct(meanReturns, invCov.map(row => dotProduct(row, meanReturns)));

      const denom = b * b - a * c;
      const lambdaVal = denom !== 0 ? (b * tr - c) / denom : 0;

      let weights = invCov.map((row, i) => 
        dotProduct(row, meanReturns.map((mr, j) => mr - lambdaVal * ones[j]))
      );
      weights = weights.map(w => Math.max(w, 0));
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = sum > 0 ? weights.map(w => w / sum) : Array(n).fill(1 / n);
      frontierWeights.push(weights);

      const vol = Math.sqrt(dotProduct(weights, covMatrix.map(row => dotProduct(row, weights))));
      const ret = dotProduct(weights, meanReturns);
      const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;

      efficientFrontier.push({
        target_return: Math.round(tr * 1000000) / 1000000,
        achieved_return: Math.round(ret * 1000000) / 1000000,
        volatility: Math.round(vol * 1000000) / 1000000,
        sharpe: Math.round(sharpe * 10000) / 10000,
      });
    } catch {
      continue;
    }
  }

  const best = efficientFrontier.length > 0 
    ? efficientFrontier.reduce((max, curr) => curr.sharpe > max.sharpe ? curr : max)
    : null;

  if (!best) {
    return {
      method: 'mean_variance',
      weights: {},
      expected_return: 0,
      expected_volatility: 0,
      sharpe_ratio: 0,
      efficient_frontier: efficientFrontier,
      optimal_portfolio: null,
    };
  }

  const bestIndex = efficientFrontier.indexOf(best);
  const optimalWeights = frontierWeights[bestIndex] || Array(n).fill(1 / n);

  return {
    method: 'mean_variance',
    weights: Object.fromEntries(symbols.map((s, i) => [s, Math.round(optimalWeights[i] * 10000) / 10000])),
    expected_return: best.achieved_return,
    expected_volatility: best.volatility,
    sharpe_ratio: best.sharpe,
    efficient_frontier: efficientFrontier,
    optimal_portfolio: best,
  };
}

function linspace(start: number, end: number, num: number): number[] {
  const step = (end - start) / (num - 1);
  return Array.from({ length: num }, (_, i) => start + step * i);
}

function estimateConditionNumber(mat: number[][]): number {
  try {
    const inv = matrixInverse(mat);
    const norm = (m: number[][]) => Math.max(...m.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));
    return norm(mat) * norm(inv);
  } catch {
    return Infinity;
  }
}
