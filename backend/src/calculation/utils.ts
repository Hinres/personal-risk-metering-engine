/**
 * [PRME-CALC-001] 计算引擎核心 - 数学工具
 * 文件: utils.ts
 * 需求描述: 提供VaR/风险/估值/优化计算所需的数学工具函数
 * 最后更新: 2026-06-17
 */

/**
 * 计算百分位数
 */
export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sortedArr.length) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * 计算数组均值
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 计算数组标准差
 */
export function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * 计算样本标准差 (ddof=1)
 */
export function sampleStdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * 计算协方差矩阵
 * returns: T x N 矩阵 (T个时间点, N个资产)
 */
export function covarianceMatrix(returns: number[][]): number[][] {
  const n = returns[0]?.length || 0;
  if (n === 0) return [];
  
  const means: number[] = [];
  for (let i = 0; i < n; i++) {
    const col = returns.map(r => r[i]);
    means.push(mean(col));
  }
  
  const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let t = 0; t < returns.length; t++) {
        sum += (returns[t][i] - means[i]) * (returns[t][j] - means[j]);
      }
      cov[i][j] = sum / (returns.length - 1);
    }
  }
  
  return cov;
}

/**
 * 矩阵乘法
 */
export function matMul(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;
  const result: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  
  return result;
}

/**
 * 矩阵与向量乘法
 */
export function matVecMul(mat: number[][], vec: number[]): number[] {
  return mat.map(row => row.reduce((sum, val, i) => sum + val * vec[i], 0));
}

/**
 * 向量点积
 */
export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * 计算相关系数矩阵
 */
export function correlationMatrix(returns: number[][]): number[][] {
  const cov = covarianceMatrix(returns);
  const n = cov.length;
  const corr: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const stdI = Math.sqrt(cov[i][i]);
      const stdJ = Math.sqrt(cov[j][j]);
      corr[i][j] = (stdI > 0 && stdJ > 0) ? cov[i][j] / (stdI * stdJ) : (i === j ? 1 : 0);
    }
  }
  
  return corr;
}

/**
 * 正态分布逆CDF (近似算法)
 */
export function normInv(p: number): number {
  // Acklam's approximation
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  
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
  
  let q, r;
  
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
 * 矩阵求逆 (高斯-约旦消元法)
 */
export function matrixInverse(mat: number[][]): number[][] {
  const n = mat.length;
  const aug = mat.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (j === i ? 1 : 0))]);
  
  for (let i = 0; i < n; i++) {
    // 选主元
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    
    if (Math.abs(aug[i][i]) < 1e-12) {
      throw new Error('Matrix is singular');
    }
    
    // 归一化
    const pivot = aug[i][i];
    for (let j = i; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }
    
    // 消元
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = i; j < 2 * n; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }
  
  return aug.map(row => row.slice(n));
}

/**
 * 矩阵条件数 (简单估计)
 */
export function matrixCondition(mat: number[][]): number {
  try {
    const inv = matrixInverse(mat);
    const norm = (m: number[][]) => Math.max(...m.map(row => row.reduce((s, v) => s + Math.abs(v), 0)));
    return norm(mat) * norm(inv);
  } catch {
    return Infinity;
  }
}
