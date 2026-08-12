/**
 * [PRME-CALC-EVT-001] EVT 极值理论计算引擎
 * 文件: evt.ts
 * 需求描述: POT + GPD 方法计算尾部风险，支持 PWM 和 MLE 双模式
 * 上游文档: PRME-Module-EVT-Engine-Design.md v1.0
 * 最后更新: 2026-07-08
 */

export interface EVTRequest {
  returns: number[];
  confidenceLevel: number;
  timeHorizon: number;
  estimationMethod: 'pwm' | 'mle';
  thresholdPercentile?: number;
}

export interface EVTResult {
  varValue: number;
  varPercentage: number;
  esValue?: number;
  esPercentage?: number;
  parameters: {
    shape: number;
    scale: number;
    threshold: number;
  };
  diagnostics: {
    totalSamples: number;
    exceedances: number;
    exceedanceRate: number;
    diagnosticsPassed: boolean;
    fallbackReason: string | null;
  };
  convergenceInfo?: {
    converged: boolean;
    iterations: number;
    logLikelihood: number;
  };
  warnings: string[];
  fallbackToMethod?: 'parametric';
  originalMethod?: 'extreme_value';
}

/**
 * 计算百分位数（线性插值）
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * 计算样本均值
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 计算样本标准差
 */
function sampleStdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * 标准正态分布逆累积分布函数（近似）
 */
function normInv(p: number): number {
  // Acklam's approximation
  const a1 = -3.969683028665376e+01;
  const a2 = 2.209460984245205e+02;
  const a3 = -2.759285104469687e+02;
  const a4 = 1.383577518672690e+02;
  const a5 = -3.066479806614716e+01;
  const a6 = 2.506628277459239e+00;
  const b1 = -5.447609879822406e+01;
  const b2 = 1.615858368580409e+02;
  const b3 = -1.556989798598866e+02;
  const b4 = 6.680131188771972e+01;
  const b5 = -1.328068155288572e+01;
  const c1 = -7.784894002430293e-03;
  const c2 = -3.223964580411365e-01;
  const c3 = -2.400758277161838e+00;
  const c4 = -2.549732539343734e+00;
  const c5 = 4.374664141464968e+00;
  const c6 = 2.938163982698783e+00;
  const d1 = 7.784695709041462e-03;
  const d2 = 3.224671290700398e-01;
  const d3 = 2.445134137142996e+00;
  const d4 = 3.754408661907416e+00;
  const p_low = 0.02425;
  const p_high = 1 - p_low;

  let q: number, r: number;
  if (p < p_low) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= p_high) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

/**
 * 选择阈值（固定百分位）
 */
function selectThreshold(returns: number[], percentileValue: number): number {
  const sorted = [...returns].sort((a, b) => a - b);
  return percentile(sorted, percentileValue);
}

/**
 * 提取超限样本
 */
function extractExceedances(returns: number[], threshold: number): number[] {
  return returns.filter(r => r > threshold).map(r => r - threshold);
}

/**
 * 运行诊断检查
 */
function runDiagnostics(
  exceedances: number[],
  totalSamples: number
): { passed: boolean; reason: string | null } {
  if (exceedances.length < 10) {
    return { passed: false, reason: 'exceedances_insufficient' };
  }
  const rate = exceedances.length / totalSamples;
  if (rate < 0.03) {
    return { passed: false, reason: 'exceedance_rate_too_low' };
  }
  return { passed: true, reason: null };
}

/**
 * PWM 估计 GPD 参数
 */
function estimateGPD_PWM(exceedances: number[]): {
  shape: number;
  scale: number;
  success: boolean;
  reason?: string;
} {
  const n = exceedances.length;
  if (n < 5) {
    return { shape: 0, scale: 0, success: false, reason: 'insufficient_exceedances' };
  }

  // 升序排列
  const sorted = [...exceedances].sort((a, b) => a - b);

  // 计算 b_0 和 b_1
  let b0 = 0;
  let b1 = 0;
  for (let i = 0; i < n; i++) {
    b0 += sorted[i];
    b1 += ((n - 1 - i) / (n - 1)) * sorted[i];
  }
  b0 /= n;
  b1 /= n;

  if (Math.abs(b0 - 2 * b1) < 1e-12 || b0 <= 0) {
    return { shape: 0, scale: 0, success: false, reason: 'shape_unstable' };
  }

  const shape = (b0 / b1) - 2;
  const scale = (2 * b0 * b1) / (b0 - 2 * b1);

  if (!isFinite(shape) || !isFinite(scale) || scale <= 0) {
    return { shape: 0, scale: 0, success: false, reason: 'shape_unstable' };
  }

  return { shape, scale, success: true };
}

/**
 * GPD 对数似然函数
 */
function gpdLogLikelihood(exceedances: number[], shape: number, scale: number): number {
  const n = exceedances.length;
  if (scale <= 0) return -Infinity;

  if (Math.abs(shape) < 1e-10) {
    // ξ ≈ 0: 指数分布
    let sum = 0;
    for (const y of exceedances) {
      if (y < 0) return -Infinity;
      sum += y;
    }
    return -n * Math.log(scale) - sum / scale;
  }

  let sum = 0;
  for (const y of exceedances) {
    const term = 1 + (shape * y) / scale;
    if (term <= 0) return -Infinity; // 定义域外
    sum += Math.log(term);
  }
  return -n * Math.log(scale) - (1 + 1 / shape) * sum;
}

/**
 * 数值梯度（中心差分）
 */
function numericalGradient(
  exceedances: number[],
  shape: number,
  scale: number,
  h: number = 1e-7
): [number, number] {
  const f = (xi: number, sig: number) => gpdLogLikelihood(exceedances, xi, sig);
  const dShape = (f(shape + h, scale) - f(shape - h, scale)) / (2 * h);
  const dScale = (f(shape, scale + h) - f(shape, scale - h)) / (2 * h);
  return [dShape, dScale];
}

/**
 * MLE 估计 GPD 参数（投影梯度上升 + 回溯线搜索）
 */
function estimateGPD_MLE(
  exceedances: number[],
  initialValues: { shape: number; scale: number }
): {
  shape: number;
  scale: number;
  converged: boolean;
  iterations: number;
  logLikelihood: number;
} {
  const MAX_ITER = 100;
  const TOL = 1e-6;
  const XI_MIN = -0.5;
  const XI_MAX = 0.5;
  const SIGMA_MIN = 1e-6;

  let shape = Math.max(XI_MIN, Math.min(XI_MAX, initialValues.shape));
  let scale = Math.max(SIGMA_MIN, initialValues.scale);

  let bestLL = gpdLogLikelihood(exceedances, shape, scale);
  let bestShape = shape;
  let bestScale = scale;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const [gShape, gScale] = numericalGradient(exceedances, shape, scale);

    // 梯度范数检查
    const gradNorm = Math.sqrt(gShape * gShape + gScale * gScale);
    if (gradNorm < TOL) {
      return {
        shape: bestShape,
        scale: bestScale,
        converged: true,
        iterations: iter + 1,
        logLikelihood: bestLL,
      };
    }

    // 回溯线搜索
    let stepSize = 1.0;
    const descentDirShape = gShape;
    const descentDirScale = gScale;

    let foundBetter = false;
    for (let ls = 0; ls < 20; ls++) {
      const newShape = Math.max(XI_MIN, Math.min(XI_MAX, shape + stepSize * descentDirShape));
      const newScale = Math.max(SIGMA_MIN, scale + stepSize * descentDirScale);
      const newLL = gpdLogLikelihood(exceedances, newShape, newScale);

      if (newLL > bestLL + 1e-12) {
        shape = newShape;
        scale = newScale;
        bestLL = newLL;
        bestShape = shape;
        bestScale = scale;
        foundBetter = true;
        break;
      }
      stepSize *= 0.5;
    }

    if (!foundBetter) {
      // 线搜索失败，可能已到达局部最优
      break;
    }
  }

  return {
    shape: bestShape,
    scale: bestScale,
    converged: false,
    iterations: MAX_ITER,
    logLikelihood: bestLL,
  };
}

const gpd = {
  estimateGPD_PWM,
  estimateGPD_MLE,
  gpdLogLikelihood,
  numericalGradient,
};

export { gpd };

/**
 * 从 GPD 参数计算 VaR
 */
function computeVaRFromGPD(
  shape: number,
  scale: number,
  threshold: number,
  totalSamples: number,
  exceedances: number,
  confidenceLevel: number,
  timeHorizon: number
): { varValue: number; varPercentage: number } {
  const pTail = 1 - confidenceLevel;
  const ratio = totalSamples / exceedances * pTail;

  let varTail: number;
  if (Math.abs(shape) < 1e-10) {
    varTail = -scale * Math.log(ratio);
  } else {
    varTail = (scale / shape) * (Math.pow(ratio, -shape) - 1);
  }

  const var1d = threshold + varTail;
  const varValue = var1d * Math.sqrt(timeHorizon);

  return {
    varValue,
    varPercentage: Math.abs(varValue) * 100,
  };
}

/**
 * 从 GPD 参数计算 ES
 */
function computeESFromGPD(
  shape: number,
  scale: number,
  varValue: number,
  threshold: number
): { esValue: number; esPercentage: number } | null {
  if (shape >= 1) return null;
  const es1d = varValue / (1 - shape) + (scale - shape * threshold) / (1 - shape);
  return {
    esValue: es1d,
    esPercentage: Math.abs(es1d) * 100,
  };
}

/**
 * 参数法回退计算
 */
function parametricFallback(
  returns: number[],
  confidenceLevel: number,
  timeHorizon: number
): { varValue: number; varPercentage: number; expectedReturn: number; volatility: number } {
  const cleanReturns = returns.filter(r => !isNaN(r) && isFinite(r));
  const m = mean(cleanReturns);
  const std = sampleStdDev(cleanReturns);
  const zScore = normInv(1 - confidenceLevel);
  const varValue = (m + zScore * std) * Math.sqrt(timeHorizon);
  return {
    varValue,
    varPercentage: Math.abs(varValue) * 100,
    expectedReturn: m,
    volatility: std,
  };
}

/**
 * EVT 计算主函数
 */
export function calculateEVT(request: EVTRequest): EVTResult {
  const {
    returns,
    confidenceLevel,
    timeHorizon,
    estimationMethod = 'pwm',
    thresholdPercentile = 95,
  } = request;

  const warnings: string[] = [];

  // 1. 输入校验
  const cleanReturns = returns.filter(r => !isNaN(r) && isFinite(r));
  if (cleanReturns.length < 30) {
    const fallback = parametricFallback(cleanReturns, confidenceLevel, timeHorizon);
    return {
      varValue: fallback.varValue,
      varPercentage: fallback.varPercentage,
      parameters: { shape: 0, scale: 0, threshold: 0 },
      diagnostics: {
        totalSamples: cleanReturns.length,
        exceedances: 0,
        exceedanceRate: 0,
        diagnosticsPassed: false,
        fallbackReason: 'insufficient_data',
      },
      warnings: ['收益率数据不足（<30天），已回退至参数法'],
      fallbackToMethod: 'parametric',
      originalMethod: 'extreme_value',
    };
  }

  // 2. 阈值选择
  const threshold = selectThreshold(cleanReturns, thresholdPercentile);

  // 3. 超限提取
  const exceedances = extractExceedances(cleanReturns, threshold);

  // 4. 诊断
  const diagnostics = runDiagnostics(exceedances, cleanReturns.length);
  if (!diagnostics.passed) {
    const fallback = parametricFallback(cleanReturns, confidenceLevel, timeHorizon);
    return {
      varValue: fallback.varValue,
      varPercentage: fallback.varPercentage,
      parameters: { shape: 0, scale: 0, threshold },
      diagnostics: {
        totalSamples: cleanReturns.length,
        exceedances: exceedances.length,
        exceedanceRate: exceedances.length / cleanReturns.length,
        diagnosticsPassed: false,
        fallbackReason: diagnostics.reason,
      },
      warnings: [`EVT诊断未通过（${diagnostics.reason}），已自动回退至参数法`],
      fallbackToMethod: 'parametric',
      originalMethod: 'extreme_value',
    };
  }

  // 5. GPD 参数估计
  let shape: number;
  let scale: number;
  let convergenceInfo: { converged: boolean; iterations: number; logLikelihood: number } | undefined;

  // 先用 PWM 获取初值
  const pwmResult = estimateGPD_PWM(exceedances);
  if (!pwmResult.success) {
    const fallback = parametricFallback(cleanReturns, confidenceLevel, timeHorizon);
    return {
      varValue: fallback.varValue,
      varPercentage: fallback.varPercentage,
      parameters: { shape: 0, scale: 0, threshold },
      diagnostics: {
        totalSamples: cleanReturns.length,
        exceedances: exceedances.length,
        exceedanceRate: exceedances.length / cleanReturns.length,
        diagnosticsPassed: false,
        fallbackReason: pwmResult.reason || 'pwm_estimation_failed',
      },
      warnings: [`PWM估计失败（${pwmResult.reason}），已自动回退至参数法`],
      fallbackToMethod: 'parametric',
      originalMethod: 'extreme_value',
    };
  }

  if (estimationMethod === 'mle') {
    const mleResult = estimateGPD_MLE(exceedances, {
      shape: pwmResult.shape,
      scale: pwmResult.scale,
    });

    if (!mleResult.converged) {
      // MLE 不收敛，回退到 PWM，但保留结果
      shape = pwmResult.shape;
      scale = pwmResult.scale;
      convergenceInfo = mleResult;
      warnings.push('MLE未收敛，已使用PWM估计结果');
    } else {
      shape = mleResult.shape;
      scale = mleResult.scale;
      convergenceInfo = mleResult;
    }
  } else {
    shape = pwmResult.shape;
    scale = pwmResult.scale;
  }

  // 6. 形状参数检查
  if (shape > 0.5 || shape < -0.5) {
    warnings.push('shape_parameter_out_of_bounds');
  }

  // 7. VaR 计算
  const { varValue, varPercentage } = computeVaRFromGPD(
    shape,
    scale,
    threshold,
    cleanReturns.length,
    exceedances.length,
    confidenceLevel,
    timeHorizon
  );

  // 8. ES 计算
  let esResult: { esValue: number; esPercentage: number } | null = null;
  if (shape < 1) {
    esResult = computeESFromGPD(shape, scale, varValue, threshold);
  }

  return {
    varValue,
    varPercentage,
    esValue: esResult?.esValue,
    esPercentage: esResult?.esPercentage,
    parameters: {
      shape,
      scale,
      threshold,
    },
    diagnostics: {
      totalSamples: cleanReturns.length,
      exceedances: exceedances.length,
      exceedanceRate: exceedances.length / cleanReturns.length,
      diagnosticsPassed: true,
      fallbackReason: null,
    },
    convergenceInfo,
    warnings,
  };
}

/**
 * 异步 EVT 计算（与同步版相同，保留接口一致性）
 */
export async function calculateEVTAsync(request: EVTRequest): Promise<EVTResult> {
  return calculateEVT(request);
}

// 测试导出（仅用于单元测试覆盖率补充）
export { gpdLogLikelihood, estimateGPD_PWM, estimateGPD_MLE, runDiagnostics, extractExceedances, selectThreshold, computeVaRFromGPD, computeESFromGPD, parametricFallback };
