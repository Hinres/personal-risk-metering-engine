/**
 * [PRME-CALC-002] VaR计算模块
 * 文件: var.ts
 * 需求描述: 实现历史模拟/参数法/蒙特卡洛/极值理论四种VaR计算方法
 * 最后更新: 2026-06-17
 */
import { mean, stdDev, sampleStdDev, percentile, covarianceMatrix, normInv } from './utils';
import { calculateEVT, EVTResult } from './evt';

export interface VaRResult {
  var_value: number;
  var_percentage: number | null;
  expected_return: number;
  volatility: number;
  components: VaRComponent[];
  risk_factors: RiskFactor[];
  evt_parameters?: {
    mode: 'pwm' | 'mle';
    threshold: number;
    shape: number;
    scale: number;
    exceedances: number;
    diagnosticsPassed: boolean;
    fallbackReason: string | null;
    convergenceInfo?: {
      converged: boolean;
      iterations: number;
      logLikelihood: number;
    };
  };
  warnings?: string[];
  fallback_reason?: string;
  original_method?: string;
  es_value?: number;
}

export interface VaRComponent {
  symbol: string;
  contribution: number;
  percentage: number;
}

export interface RiskFactor {
  factor: string;
  exposure: number;
  contribution: number;
}

export interface EVTParameters {
  mode: 'pwm' | 'mle';
  threshold: number;
  shape: number;
  scale: number;
  exceedances: number;
  threshold_percentile: number;
  diagnosticsPassed: boolean;
  fallbackReason: string | null;
  convergenceInfo?: {
    converged: boolean;
    iterations: number;
    logLikelihood: number;
  };
}

/**
 * 历史模拟法计算VaR
 */
export function calculateHistoricalVaR(
  returns: number[][],
  weights: number[],
  confidenceLevel: number = 0.95,
  symbols?: string[]
): VaRResult {
  if (!returns || returns.length === 0) {
    return {
      var_value: 0,
      var_percentage: 0,
      expected_return: 0,
      volatility: 0,
      components: [],
      risk_factors: [{ factor: 'Market Risk', exposure: 0, contribution: 100 }],
    };
  }

  if (!weights || weights.length === 0) {
    weights = Array(returns[0]?.length || 1).fill(1);
  }

  const nAssets = returns[0].length;
  const normalizedWeights = weights.map(w => w / weights.reduce((a, b) => a + b, 0));

  // 计算组合收益率
  const portfolioReturns = returns.map(r => 
    r.reduce((sum, val, i) => sum + val * (normalizedWeights[i] || 0), 0)
  );

  const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
  const varValue = percentile(sortedReturns, (1 - confidenceLevel) * 100);
  const expectedReturn = mean(portfolioReturns);
  const volatility = stdDev(portfolioReturns);

  // 成分贡献
  const components: VaRComponent[] = [];
  if (returns[0].length > 1) {
    for (let i = 0; i < nAssets; i++) {
      const symbol = symbols?.[i] || `Asset_${i}`;
      const assetReturns = returns.map(r => r[i] || 0);
      const sortedAsset = [...assetReturns].sort((a, b) => a - b);
      const marginalVaR = percentile(sortedAsset, (1 - confidenceLevel) * 100);
      components.push({
        symbol,
        contribution: marginalVaR * normalizedWeights[i],
        percentage: normalizedWeights[i] * 100,
      });
    }
  }

  // 风险因子分解
  let riskFactors: RiskFactor[];
  const totalVar = volatility ** 2;
  if (totalVar > 0 && returns[0].length > 1) {
    const covMatrix = covarianceMatrix(returns);
    const mvar = covMatrix.map(row => 
      row.reduce((sum, val, j) => sum + val * normalizedWeights[j], 0) / volatility
    );
    const contributions = normalizedWeights.map((w, i) => w * mvar[i]);
    riskFactors = [];
    for (let i = 0; i < Math.min(nAssets, 5); i++) {
      const symbol = symbols?.[i] || `Asset_${i}`;
      riskFactors.push({
        factor: symbol,
        exposure: contributions[i],
        contribution: volatility > 0 ? (contributions[i] / volatility * 100) : 0,
      });
    }
  } else {
    riskFactors = [{ factor: 'Market Risk', exposure: volatility, contribution: 100 }];
  }

  return {
    var_value: varValue,
    var_percentage: expectedReturn !== 0 ? Math.abs(varValue) * 100 : null,
    expected_return: expectedReturn,
    volatility,
    components,
    risk_factors: riskFactors,
  };
}

/**
 * 参数法(方差-协方差)计算VaR
 */
export function calculateParametricVaR(
  meanReturn: number,
  stdDevValue: number,
  confidenceLevel: number = 0.95,
  symbols?: string[]
): VaRResult {
  const std = stdDevValue < 0 ? 0 : stdDevValue;
  const cl = confidenceLevel > 0 && confidenceLevel < 1 ? confidenceLevel : 0.95;
  
  const zScore = normInv(1 - cl);
  const varValue = meanReturn + zScore * std;
  const varPercentage = Math.abs(varValue) * 100;

  return {
    var_value: varValue,
    var_percentage: varPercentage,
    expected_return: meanReturn,
    volatility: std,
    components: [],
    risk_factors: [{ factor: 'Market Risk', exposure: std, contribution: 100 }],
  };
}

/**
 * 蒙特卡洛模拟法计算VaR
 */
export function calculateMonteCarloVaR(
  returns: number[][],
  weights: number[],
  confidenceLevel: number = 0.95,
  nSimulations: number = 10000,
  symbols?: string[],
  randomSeed: number = 42
): VaRResult {
  if (!returns || returns.length === 0) {
    return {
      var_value: 0,
      var_percentage: 0,
      expected_return: 0,
      volatility: 0,
      components: [],
      risk_factors: [{ factor: 'Market Risk', exposure: 0, contribution: 100 }],
    };
  }

  if (!weights || weights.length === 0) {
    weights = Array(returns[0]?.length || 1).fill(1);
  }

  const nAssets = returns[0].length;
  const normalizedWeights = weights.map(w => w / weights.reduce((a, b) => a + b, 0));

  // 计算均值和协方差
  const means: number[] = [];
  for (let i = 0; i < nAssets; i++) {
    means.push(mean(returns.map(r => r[i])));
  }

  const covMatrix = covarianceMatrix(returns);

  // 线性代数辅助：Cholesky分解
  const chol = choleskyDecompose(covMatrix);
  
  // 生成模拟收益
  const simulatedReturns: number[][] = [];
  let seed = randomSeed;
  const rng = () => {
    // LCG随机数生成器
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  
  const boxMuller = () => {
    const u1 = rng();
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  for (let s = 0; s < nSimulations; s++) {
    const z = Array(nAssets).fill(0).map(() => boxMuller());
    const simulated = Array(nAssets).fill(0);
    for (let i = 0; i < nAssets; i++) {
      for (let j = 0; j <= i; j++) {
        simulated[i] += chol[i][j] * z[j];
      }
      simulated[i] += means[i];
    }
    simulatedReturns.push(simulated);
  }

  // 计算组合收益
  const portfolioReturns = simulatedReturns.map(r =>
    r.reduce((sum, val, i) => sum + val * normalizedWeights[i], 0)
  );

  const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
  const varValue = percentile(sortedReturns, (1 - confidenceLevel) * 100);
  const expectedReturn = mean(portfolioReturns);
  const volatility = stdDev(portfolioReturns);

  // 成分贡献
  const components: VaRComponent[] = [];
  if (nAssets > 1) {
    for (let i = 0; i < nAssets; i++) {
      const symbol = symbols?.[i] || `Asset_${i}`;
      const assetSimulated = simulatedReturns.map(r => r[i]);
      const sortedAsset = [...assetSimulated].sort((a, b) => a - b);
      const assetVaR = percentile(sortedAsset, (1 - confidenceLevel) * 100);
      components.push({
        symbol,
        contribution: assetVaR * normalizedWeights[i],
        percentage: normalizedWeights[i] * 100,
      });
    }
  }

  // 风险因子
  let riskFactors: RiskFactor[];
  if (nAssets > 1 && volatility > 0) {
    const mvar = covMatrix.map(row =>
      row.reduce((sum, val, j) => sum + val * normalizedWeights[j], 0) / volatility
    );
    const contributions = normalizedWeights.map((w, i) => w * mvar[i]);
    riskFactors = [];
    for (let i = 0; i < Math.min(nAssets, 5); i++) {
      const symbol = symbols?.[i] || `Asset_${i}`;
      riskFactors.push({
        factor: symbol,
        exposure: contributions[i],
        contribution: volatility > 0 ? (contributions[i] / volatility * 100) : 0,
      });
    }
  } else {
    riskFactors = [{ factor: 'Market Risk', exposure: volatility, contribution: 100 }];
  }

  return {
    var_value: varValue,
    var_percentage: Math.abs(varValue) * 100,
    expected_return: expectedReturn,
    volatility,
    components,
    risk_factors: riskFactors,
  };
}

/**
 * 极值理论(EVT)计算VaR - POT方法
 * v1.2: 支持 PWM(默认) 和 MLE 双模式
 */
export function calculateExtremeValueVaR(
  returns: number[],
  confidenceLevel: number = 0.95,
  timeHorizon: number = 1,
  symbols?: string[],
  estimationMethod: 'pwm' | 'mle' = 'pwm'
): VaRResult & { evt_parameters?: EVTParameters } {
  if (!returns || returns.length === 0) {
    return {
      var_value: 0,
      var_percentage: 0,
      expected_return: 0,
      volatility: 0,
      components: [],
      risk_factors: [],
    };
  }

  const cleanReturns = returns.filter(r => !isNaN(r) && isFinite(r));

  // 调用新的 EVT 引擎
  const evtResult = calculateEVT({
    returns: cleanReturns,
    confidenceLevel,
    timeHorizon,
    estimationMethod,
    thresholdPercentile: 95,
  });

  const meanReturn = mean(cleanReturns);
  const std = sampleStdDev(cleanReturns);

  const result: VaRResult & { evt_parameters?: EVTParameters } = {
    var_value: evtResult.varValue,
    var_percentage: evtResult.varPercentage,
    expected_return: meanReturn,
    volatility: std,
    components: [],
    risk_factors: [
      { factor: 'Tail Risk (EVT/GPD)', exposure: evtResult.parameters.scale, contribution: 80 },
      { factor: 'Market Risk', exposure: std, contribution: 20 },
    ],
    evt_parameters: {
      mode: estimationMethod,
      threshold: evtResult.parameters.threshold,
      shape: evtResult.parameters.shape,
      scale: evtResult.parameters.scale,
      exceedances: evtResult.diagnostics.exceedances,
      threshold_percentile: 95,
      diagnosticsPassed: evtResult.diagnostics.diagnosticsPassed,
      fallbackReason: evtResult.diagnostics.fallbackReason,
      convergenceInfo: evtResult.convergenceInfo,
    },
    warnings: evtResult.warnings,
  };

  // 回退信息
  if (evtResult.fallbackToMethod) {
    result.fallback_reason = evtResult.diagnostics.fallbackReason || 'diagnostics_failed';
    result.original_method = 'extreme_value';
    // 更新 risk_factors 标签
    result.risk_factors = [
      { factor: `Market Risk (EVT fallback: ${evtResult.fallbackToMethod})`, exposure: std, contribution: 100 },
    ];
  }

  // ES（可选）
  if (evtResult.esValue !== undefined) {
    result.es_value = evtResult.esValue;
  }

  return result;
}

// Cholesky分解辅助函数
function choleskyDecompose(mat: number[][]): number[][] {
  const n = mat.length;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = mat[i][i] - sum;
        L[i][j] = val > 0 ? Math.sqrt(val) : 0;
      } else {
        L[i][j] = (mat[i][j] - sum) / L[j][j];
      }
    }
  }
  
  return L;
}
