/**
 * [DEV-SELFTEST-001] VaR 计算引擎开发自测
 * 范围: 精度、性能、边界条件、异常处理
 * 注意: 此为开发自测，不替代 QA 系统测试
 * 最后更新: 2026-06-18 (转换为 Jest 格式)
 */

import { calculateHistoricalVaR, calculateParametricVaR, calculateMonteCarloVaR, calculateExtremeValueVaR } from '../../src/calculation/var';
import { mean, stdDev, percentile, covarianceMatrix, normInv } from '../../src/calculation/utils';

// ==================== 测试工具 ====================

function assertApprox(actual: number, expected: number, tolerance: number = 0.01, label: string = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`[${label}] 精度不符: actual=${actual}, expected=${expected}, diff=${diff}, tolerance=${tolerance}`);
  }
}

function assertTrue(condition: boolean, label: string = '') {
  if (!condition) {
    throw new Error(`[${label}] 断言失败`);
  }
}

function generateNormalReturns(n: number, meanVal: number, std: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    result.push(meanVal + std * z1);
    if (i + 1 < n) result.push(meanVal + std * z2);
  }
  return result;
}

function generateMultiAssetReturns(nDays: number, nAssets: number, means: number[], stds: number[], corr: number[][]): number[][] {
  const returns: number[][] = [];
  const L: number[][] = Array.from({ length: nAssets }, () => Array(nAssets).fill(0));
  for (let i = 0; i < nAssets; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(corr[i][i] - sum);
      } else {
        L[i][j] = (corr[i][j] - sum) / L[j][j];
      }
    }
  }
  
  for (let d = 0; d < nDays; d++) {
    const z = Array.from({ length: nAssets }, () => generateNormalReturns(1, 0, 1)[0]);
    const day: number[] = [];
    for (let i = 0; i < nAssets; i++) {
      let r = means[i];
      for (let j = 0; j <= i; j++) {
        r += L[i][j] * z[j] * stds[i];
      }
      day.push(r);
    }
    returns.push(day);
  }
  return returns;
}

describe('VaR Calculation - 开发自测', () => {
  // TC-001: 历史模拟法 - 单资产正态分布
  it('TC-001: 历史模拟法-单资产', () => {
    const returns = generateNormalReturns(252, 0.0005, 0.02).map(r => [r]);
    const result = calculateHistoricalVaR(returns, [1], 0.95, ['AAPL']);
    
    assertTrue(result.var_value < 0, 'TC-001: VaR应为负数（损失）');
    assertTrue(result.var_percentage !== null && result.var_percentage > 0, 'TC-001: VaR百分比应为正');
    assertTrue(Math.abs(result.volatility - 0.02) < 0.005, 'TC-001: 波动率接近0.02');
  });

  // TC-002: 参数法 - 已知均值和标准差
  it('TC-002: 参数法-已知参数', () => {
    const meanReturn = 0.001;
    const stdDevVal = 0.015;
    const result = calculateParametricVaR(meanReturn, stdDevVal, 0.95, ['AAPL']);
    
    const expectedVaR = meanReturn + (-1.645) * stdDevVal;
    assertApprox(result.var_value, expectedVaR, 0.001, 'TC-002: VaR值');
    assertApprox(result.var_percentage!, Math.abs(expectedVaR) * 100, 0.1, 'TC-002: VaR百分比');
  });

  // TC-003: 蒙特卡洛 - 多资产组合
  it('TC-003: 蒙特卡洛-多资产', () => {
    const nAssets = 3;
    const means = [0.001, 0.0008, 0.0012];
    const stds = [0.02, 0.025, 0.018];
    const corr = [
      [1, 0.3, 0.5],
      [0.3, 1, 0.4],
      [0.5, 0.4, 1]
    ];
    const returns = generateMultiAssetReturns(252, nAssets, means, stds, corr);
    const weights = [0.4, 0.3, 0.3];
    
    const result = calculateMonteCarloVaR(returns, weights, 0.95, 10000, ['AAPL', 'GOOGL', 'MSFT'], 42);
    
    assertTrue(result.var_value < 0, 'TC-003: VaR应为负数');
    assertTrue(result.components.length === nAssets, 'TC-003: 成分数等于资产数');
    assertTrue(result.risk_factors.length > 0, 'TC-003: 风险因子非空');
  });

  // TC-004: 极值理论 - 足够数据
  it('TC-004: 极值理论-足够数据', () => {
    const returns = generateNormalReturns(500, 0.0005, 0.02);
    const result = calculateExtremeValueVaR(returns, 0.95, 1, ['AAPL']);
    
    assertTrue(result.evt_parameters !== undefined, 'TC-004: EVT参数存在');
    assertTrue(result.evt_parameters!.exceedances > 0, 'TC-004: 超限数>0');
  });

  // TC-005: 空数据保护
  it('TC-005: 空数据保护', () => {
    const result1 = calculateHistoricalVaR([], [1], 0.95);
    assertTrue(result1.var_value === 0, 'TC-005: 空数据VaR=0');
    
    const result2 = calculateParametricVaR(0, 0, 0.95);
    assertTrue(result2.var_value === 0, 'TC-005: 零参数VaR=0');
    
    const result3 = calculateMonteCarloVaR([], [1], 0.95);
    assertTrue(result3.var_value === 0, 'TC-005: 空数据蒙特卡洛VaR=0');
    
    const result4 = calculateExtremeValueVaR([], 0.95, 1);
    assertTrue(result4.var_value === 0, 'TC-005: 空数据EVTVaR=0');
  });

  // TC-006: 置信度边界
  it('TC-006: 置信度边界', () => {
    const returns = generateNormalReturns(252, 0.0005, 0.02).map(r => [r]);
    
    const r90 = calculateHistoricalVaR(returns, [1], 0.90, ['AAPL']);
    const r95 = calculateHistoricalVaR(returns, [1], 0.95, ['AAPL']);
    const r99 = calculateHistoricalVaR(returns, [1], 0.99, ['AAPL']);
    
    assertTrue(Math.abs(r99.var_value) > Math.abs(r95.var_value), 'TC-006: 99% VaR > 95% VaR');
    assertTrue(Math.abs(r95.var_value) > Math.abs(r90.var_value), 'TC-006: 95% VaR > 90% VaR');
  });

  // TC-007: 数学工具函数
  it('TC-007: 数学工具函数', () => {
    const arr = [1, 2, 3, 4, 5];
    assertApprox(mean(arr), 3, 0.001, 'TC-007: 均值');
    assertApprox(stdDev(arr), Math.sqrt(2), 0.001, 'TC-007: 标准差');
    assertApprox(percentile([1, 2, 3, 4, 5], 50), 3, 0.001, 'TC-007: 中位数');
    assertApprox(percentile([1, 2, 3, 4, 5], 0), 1, 0.001, 'TC-007: 0百分位');
    assertApprox(percentile([1, 2, 3, 4, 5], 100), 5, 0.001, 'TC-007: 100百分位');
    assertApprox(normInv(0.5), 0, 0.001, 'TC-007: normInv(0.5)=0');
    assertApprox(normInv(0.95), 1.645, 0.01, 'TC-007: normInv(0.95)≈1.645');
    assertApprox(normInv(0.05), -1.645, 0.01, 'TC-007: normInv(0.05)≈-1.645');
  });

  // TC-008: 协方差矩阵
  it('TC-008: 协方差矩阵', () => {
    const returns = [
      [0.01, 0.02],
      [0.02, 0.01],
      [-0.01, -0.02],
      [-0.02, -0.01],
    ];
    const cov = covarianceMatrix(returns);
    
    assertTrue(cov.length === 2, 'TC-008: 2x2矩阵');
    assertTrue(cov[0][0] > 0, 'TC-008: 方差>0');
    assertTrue(cov[1][1] > 0, 'TC-008: 方差>0');
  });

  // TC-009: 性能测试 - 蒙特卡洛大规模模拟
  it('TC-009: 性能测试-蒙特卡洛50000次', () => {
    const nAssets = 10;
    const nDays = 252;
    const means = Array(nAssets).fill(0.001);
    const stds = Array(nAssets).fill(0.02);
    const corr = Array.from({ length: nAssets }, (_, i) => 
      Array.from({ length: nAssets }, (_, j) => i === j ? 1 : 0.3)
    );
    
    const returns = generateMultiAssetReturns(nDays, nAssets, means, stds, corr);
    const weights = Array(nAssets).fill(1 / nAssets);
    
    const start = Date.now();
    const result = calculateMonteCarloVaR(returns, weights, 0.95, 50000, undefined, 42);
    const elapsed = Date.now() - start;
    
    assertTrue(result.var_value < 0, 'TC-009: VaR应为负数');
    assertTrue(elapsed < 5000, `TC-009: 50000次模拟应在5秒内完成，实际${elapsed}ms`);
  });

  // TC-010: 历史模拟法性能
  it('TC-010: 性能测试-50资产历史模拟', () => {
    const nAssets = 50;
    const nDays = 252;
    const returns = Array.from({ length: nDays }, () => 
      Array.from({ length: nAssets }, () => (Math.random() - 0.5) * 0.04)
    );
    const weights = Array(nAssets).fill(1 / nAssets);
    
    const start = Date.now();
    const result = calculateHistoricalVaR(returns, weights, 0.95);
    const elapsed = Date.now() - start;
    
    assertTrue(elapsed < 1000, `TC-010: 50资产252天应在1秒内完成，实际${elapsed}ms`);
  });
});
