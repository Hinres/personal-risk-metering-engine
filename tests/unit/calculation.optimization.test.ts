/**
 * [PRME-CALC-006] calculation/optimization 单元测试
 * 测试范围: riskParityOptimization, minimumVarianceOptimization, maximumSharpeOptimization, meanVarianceOptimization
 * 最后更新: 2026-07-24
 */
import {
  riskParityOptimization,
  minimumVarianceOptimization,
  maximumSharpeOptimization,
  meanVarianceOptimization,
} from '../../src/calculation/optimization';
import { covarianceMatrix } from '../../src/calculation/utils';

function generateReturns(days: number, assets: number): number[][] {
  return Array.from({ length: days }, () =>
    Array.from({ length: assets }, () => (Math.random() - 0.5) * 0.02)
  );
}

describe('calculation/optimization', () => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  let returns: number[][];
  let cov: number[][];

  beforeEach(() => {
    returns = generateReturns(252, symbols.length);
    cov = covarianceMatrix(returns);
  });

  describe('riskParityOptimization', () => {
    it('should return error for empty assets', () => {
      const result = riskParityOptimization([], [], []);
      expect(result.error).toBe('No assets provided');
    });

    it('should calculate risk parity weights', () => {
      const result = riskParityOptimization(returns, cov, symbols) as any;
      expect(result.method).toBe('risk_parity');
      expect(Object.keys(result.weights).length).toBe(symbols.length);
      const sum = Object.values(result.weights).reduce((a: any, b: any) => a + b, 0);
      expect(sum).toBeCloseTo(1, 3);
      expect(result.expected_return).not.toBeNaN();
      expect(result.expected_volatility).not.toBeNaN();
    });

    it('should support target volatility scaling', () => {
      const result = riskParityOptimization(returns, cov, symbols, 0.1) as any;
      expect(result.scaled_weights).toBeDefined();
      expect(result.scaled_volatility).toBe(0.1);
    });
  });

  describe('minimumVarianceOptimization', () => {
    it('should return error for empty assets', () => {
      const result = minimumVarianceOptimization([], [], []);
      expect(result.error).toBe('No assets provided');
    });

    it('should calculate minimum variance weights without short', () => {
      const result = minimumVarianceOptimization(returns, cov, symbols, false) as any;
      expect(result.method).toBe('minimum_variance');
      const sum = Object.values(result.weights).reduce((a: any, b: any) => a + b, 0);
      expect(sum).toBeCloseTo(1, 3);
      expect(Object.values(result.weights).every((w: any) => w >= 0)).toBe(true);
    });

    it('should allow short positions', () => {
      const result = minimumVarianceOptimization(returns, cov, symbols, true) as any;
      expect(result.method).toBe('minimum_variance');
      expect(Object.keys(result.weights).length).toBe(symbols.length);
    });
  });

  describe('maximumSharpeOptimization', () => {
    it('should return error for empty assets', () => {
      const result = maximumSharpeOptimization([], [], []);
      expect(result.error).toBe('No assets provided');
    });

    it('should calculate maximum sharpe weights without short', () => {
      const result = maximumSharpeOptimization(returns, cov, symbols, 0.03, false) as any;
      expect(result.method).toBe('maximum_sharpe');
      const sum = Object.values(result.weights).reduce((a: any, b: any) => a + b, 0);
      expect(sum).toBeCloseTo(1, 3);
      expect(Object.values(result.weights).every((w: any) => w >= 0)).toBe(true);
      expect(result.sharpe_ratio).not.toBeNaN();
    });
  });

  describe('meanVarianceOptimization', () => {
    it('should return error for empty assets', () => {
      const result = meanVarianceOptimization([], [], []);
      expect(result.error).toBe('No assets provided');
    });

    it('should calculate efficient frontier', () => {
      const result = meanVarianceOptimization(returns, cov, symbols, null, null, 0.03) as any;
      expect(result.method).toBe('mean_variance');
      expect(result.efficient_frontier!.length).toBeGreaterThan(0);
      expect(result.optimal_portfolio).toBeDefined();
    });
  });
});
