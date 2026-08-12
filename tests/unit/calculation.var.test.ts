/**
 * [PRME-CALC-002] VaR计算模块单元测试
 * 测试范围: calculateHistoricalVaR, calculateParametricVaR, calculateMonteCarloVaR, calculateExtremeValueVaR
 * 最后更新: 2026-06-30
 */
import {
  calculateHistoricalVaR,
  calculateParametricVaR,
  calculateMonteCarloVaR,
  calculateExtremeValueVaR,
} from '../../src/calculation/var';

describe('calculation/var', () => {
  describe('calculateHistoricalVaR', () => {
    it('should handle empty returns array', () => {
      const result = calculateHistoricalVaR([], [0.5], 0.95);
      expect(result.var_value).toBe(0);
      expect(result.var_percentage).toBe(0);
      expect(result.expected_return).toBe(0);
      expect(result.volatility).toBe(0);
    });

    it('should handle undefined/null weights', () => {
      const returns = [[0.01, 0.02], [0.015, 0.025], [-0.005, -0.01]];
      const result = calculateHistoricalVaR(returns, undefined as any, 0.95);
      expect(result.var_value).not.toBe(0);
      expect(result.components.length).toBe(2);
    });

    it('should handle empty weights array', () => {
      const returns = [[0.01, 0.02], [0.015, 0.025]];
      const result = calculateHistoricalVaR(returns, [], 0.95);
      expect(result.var_value).not.toBe(0);
    });

    it('should calculate single asset VaR (no components/risk factors breakdown)', () => {
      const returns = [[0.01], [0.02], [-0.01], [0.015], [-0.02]];
      const weights = [1];
      const result = calculateHistoricalVaR(returns, weights, 0.95, ['AAPL']);
      expect(result.var_value).not.toBe(0);
      expect(result.components.length).toBe(0);
      expect(result.risk_factors.length).toBe(1);
      expect(result.risk_factors[0].factor).toBe('Market Risk');
    });

    it('should calculate multi-asset VaR with components and risk factors', () => {
      const returns = [
        [0.01, 0.02, -0.005],
        [0.015, 0.025, 0.01],
        [-0.005, -0.01, 0.005],
        [0.02, 0.01, -0.015],
        [-0.01, -0.005, 0.02],
      ];
      const weights = [0.4, 0.35, 0.25];
      const result = calculateHistoricalVaR(returns, weights, 0.95, ['AAPL', 'GOOGL', 'TSLA']);
      expect(result.var_value).not.toBe(0);
      expect(result.components.length).toBe(3);
      expect(result.risk_factors.length).toBe(3);
      expect(result.risk_factors[0].factor).toBe('AAPL');
    });

    it('should handle zero total variance (single constant return)', () => {
      const returns = [[0.01], [0.01], [0.01]];
      const weights = [1];
      const result = calculateHistoricalVaR(returns, weights, 0.95, ['AAPL']);
      expect(result.volatility).toBe(0);
      expect(result.risk_factors[0].factor).toBe('Market Risk');
    });
  });

  describe('calculateParametricVaR', () => {
    it('should handle negative stdDev (clamp to 0)', () => {
      const result = calculateParametricVaR(0.01, -0.02, 0.95);
      expect(result.volatility).toBe(0);
      expect(result.var_value).toBe(0.01);
    });

    it('should handle invalid confidence level (clamp to 0.95)', () => {
      const result1 = calculateParametricVaR(0.01, 0.02, 1.5);
      expect(result1.var_value).not.toBeNaN();
      const result2 = calculateParametricVaR(0.01, 0.02, -0.1);
      expect(result2.var_value).not.toBeNaN();
      const result3 = calculateParametricVaR(0.01, 0.02, 0);
      expect(result3.var_value).not.toBeNaN();
    });

    it('should calculate parametric VaR correctly', () => {
      const result = calculateParametricVaR(0.001, 0.02, 0.95);
      expect(result.var_value).not.toBe(0);
      expect(result.volatility).toBe(0.02);
      expect(result.var_percentage).toBeGreaterThan(0);
    });
  });

  describe('calculateMonteCarloVaR', () => {
    it('should handle empty returns array', () => {
      const result = calculateMonteCarloVaR([], [0.5], 0.95, 1000);
      expect(result.var_value).toBe(0);
      expect(result.volatility).toBe(0);
    });

    it('should handle undefined/null weights', () => {
      const returns = [[0.01, 0.02], [0.015, 0.025], [-0.005, -0.01]];
      const result = calculateMonteCarloVaR(returns, undefined as any, 0.95, 1000);
      expect(result.var_value).not.toBe(0);
    });

    it('should handle empty weights array', () => {
      const returns = [[0.01, 0.02], [0.015, 0.025]];
      const result = calculateMonteCarloVaR(returns, [], 0.95, 1000);
      expect(result.var_value).not.toBe(0);
    });

    it('should calculate single asset Monte Carlo VaR (no components breakdown)', () => {
      const returns = [[0.01], [0.02], [-0.01], [0.015], [-0.02]];
      const weights = [1];
      const result = calculateMonteCarloVaR(returns, weights, 0.95, 5000, ['AAPL']);
      expect(result.var_value).not.toBe(0);
      expect(result.components.length).toBe(0);
      expect(result.risk_factors.length).toBe(1);
      expect(result.risk_factors[0].factor).toBe('Market Risk');
    });

    it('should calculate multi-asset Monte Carlo VaR with components', () => {
      const returns = [
        [0.01, 0.02, -0.005],
        [0.015, 0.025, 0.01],
        [-0.005, -0.01, 0.005],
        [0.02, 0.01, -0.015],
        [-0.01, -0.005, 0.02],
      ];
      const weights = [0.4, 0.35, 0.25];
      const result = calculateMonteCarloVaR(returns, weights, 0.95, 5000, ['AAPL', 'GOOGL', 'TSLA']);
      expect(result.var_value).not.toBe(0);
      expect(result.components.length).toBe(3);
      expect(result.risk_factors.length).toBe(3);
    });

    it('should handle zero volatility in risk factors', () => {
      const returns = [[0.01], [0.01], [0.01]];
      const weights = [1];
      const result = calculateMonteCarloVaR(returns, weights, 0.95, 1000, ['AAPL']);
      expect(result.volatility).toBeCloseTo(0, 10);
      expect(result.risk_factors[0].factor).toBe('Market Risk');
    });

    it('should use custom random seed', () => {
      const returns = [
        [0.01, 0.02],
        [0.015, 0.025],
        [-0.005, -0.01],
      ];
      const weights = [0.5, 0.5];
      const result1 = calculateMonteCarloVaR(returns, weights, 0.95, 1000, ['A', 'B'], 42);
      const result2 = calculateMonteCarloVaR(returns, weights, 0.95, 1000, ['A', 'B'], 42);
      expect(result1.var_value).toBe(result2.var_value);
    });
  });

  describe('calculateExtremeValueVaR', () => {
    it('should handle empty returns array', () => {
      const result = calculateExtremeValueVaR([], 0.95);
      expect(result.var_value).toBe(0);
      expect(result.volatility).toBe(0);
    });

    it('should fallback to parametric when clean returns < 30', () => {
      const returns = Array.from({ length: 20 }, (_, i) => 0.01 + i * 0.001);
      const result = calculateExtremeValueVaR(returns, 0.95);
      expect(result.var_value).not.toBe(0);
      expect(result.risk_factors[0].factor).toContain('EVT fallback');
    });

    it('should fallback to parametric when excesses < 5', () => {
      const returns = Array.from({ length: 100 }, () => Math.random() * 0.02 - 0.005);
      const result = calculateExtremeValueVaR(returns, 0.95);
      expect(result.var_value).not.toBeNaN();
    });

    it('should calculate EVT VaR with shape ≈ 0 (exponential tail)', () => {
      // Generate returns with many extreme values to trigger shape≈0 path
      const returns: number[] = [];
      for (let i = 0; i < 200; i++) {
        returns.push(i < 150 ? Math.random() * 0.01 : 0.05 + Math.random() * 0.1);
      }
      const result = calculateExtremeValueVaR(returns, 0.95, 1);
      expect(result.var_value).not.toBeNaN();
      expect(result).toHaveProperty('evt_parameters');
    });

    it('should calculate EVT VaR with non-zero shape', () => {
      // Generate returns with fat tail to get non-zero shape
      const returns: number[] = [];
      for (let i = 0; i < 200; i++) {
        returns.push(i < 130 ? Math.random() * 0.01 - 0.005 : 0.02 + Math.random() * 0.05);
      }
      const result = calculateExtremeValueVaR(returns, 0.95);
      expect(result.var_value).not.toBeNaN();
      expect(result.evt_parameters).toBeDefined();
      expect(result.evt_parameters!.exceedances).toBeGreaterThanOrEqual(5);
    });

    it('should handle returns with NaN/Infinity values', () => {
      const returns = [
        0.01, 0.02, NaN, 0.015, Infinity, -0.01, 0.005, -0.02,
        ...Array.from({ length: 50 }, () => Math.random() * 0.02 - 0.005),
      ];
      const result = calculateExtremeValueVaR(returns, 0.95);
      expect(result.var_value).not.toBeNaN();
    });

    it('should handle timeHorizon > 1', () => {
      const returns = Array.from({ length: 100 }, () => Math.random() * 0.04 - 0.01);
      const result = calculateExtremeValueVaR(returns, 0.95, 5);
      expect(result.var_value).not.toBeNaN();
    });

    it('should handle negative varExcess in GPD estimation', () => {
      // All returns identical → zero variance → triggers else branch
      const returns = Array.from({ length: 50 }, () => 0.01);
      const result = calculateExtremeValueVaR(returns, 0.95);
      expect(result.var_value).not.toBeNaN();
    });
  });
});
