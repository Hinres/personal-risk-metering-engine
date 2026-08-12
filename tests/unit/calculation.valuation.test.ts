/**
 * [PRME-CALC-005] calculation/valuation 单元测试
 * 测试范围: PE/PB/DCF/DDM/PEG 五种估值方法
 * 最后更新: 2026-07-24
 */
import {
  calculatePEValuation,
  calculatePBValuation,
  calculateDCFValuation,
  calculateDDMValuation,
  calculatePEGValuation,
} from '../../src/calculation/valuation';

describe('calculation/valuation', () => {
  describe('calculatePEValuation', () => {
    it('should return error when EPS is not positive', () => {
      const result = calculatePEValuation(0, 15);
      expect(result).toHaveProperty('error');
    });

    it('should calculate industry PE valuation', () => {
      const result = calculatePEValuation(10, 15, null, null, 0.03, 'industry') as any;
      expect(result.industry_pe).toBeDefined();
      expect(result.industry_pe.intrinsic_value).toBe(150);
    });

    it('should calculate all PE methods and summary', () => {
      const result = calculatePEValuation(10, 15, 12, 0.2) as any;
      expect(result.industry_pe).toBeDefined();
      expect(result.historical_pe).toBeDefined();
      expect(result.growth_adjusted).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.mean_value).toBeGreaterThan(0);
      expect(result.summary.range_low).toBeLessThan(result.summary.range_high);
    });

    it('should calculate growth adjusted PE only', () => {
      const result = calculatePEValuation(10, 15, null, 0.2, 0.03, 'growth') as any;
      expect(result.growth_adjusted).toBeDefined();
      expect(result.industry_pe).toBeUndefined();
    });
  });

  describe('calculatePBValuation', () => {
    it('should return error when book value is not positive', () => {
      const result = calculatePBValuation(0, 2);
      expect(result).toHaveProperty('error');
    });

    it('should calculate all PB methods and summary', () => {
      const result = calculatePBValuation(20, 2, 1.8, 0.15) as any;
      expect(result.industry_pb).toBeDefined();
      expect(result.historical_pb).toBeDefined();
      expect(result.roe_adjusted).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should cap ROE adjusted PB between 0.5 and 5.0', () => {
      const resultHighROE = calculatePBValuation(20, 2, null, 0.5) as any;
      expect(resultHighROE.roe_adjusted.pb_ratio).toBeLessThanOrEqual(5.0);
      const resultLowROE = calculatePBValuation(20, 2, null, 0.02) as any;
      expect(resultLowROE.roe_adjusted.pb_ratio).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('calculateDCFValuation', () => {
    it('should return error when free cash flow is not positive', () => {
      const result = calculateDCFValuation(0, [0.1], 0.02);
      expect(result).toHaveProperty('error');
    });

    it('should return error when growth rates are empty', () => {
      const result = calculateDCFValuation(1000, [], 0.02);
      expect(result).toHaveProperty('error');
    });

    it('should return error when terminal growth >= discount rate', () => {
      const result = calculateDCFValuation(1000, [0.1], 0.12, 0.1);
      expect(result).toHaveProperty('error');
    });

    it('should calculate DCF valuation with sensitivity analysis', () => {
      const result = calculateDCFValuation(1000, [0.1, 0.08, 0.06], 0.02, 0.1, 100, 5000) as any;
      expect(result.method).toBe('dcf');
      expect(result.intrinsic_value).toBeGreaterThan(0);
      expect(result.forecast_period.length).toBe(3);
      expect(Object.keys(result.sensitivity_analysis).length).toBeGreaterThan(0);
      expect(result.range_low).toBeLessThan(result.range_high);
    });
  });

  describe('calculateDDMValuation', () => {
    it('should return error when dividend is not positive', () => {
      const result = calculateDDMValuation(0, 0.03);
      expect(result).toHaveProperty('error');
    });

    it('should return error when growth rate >= discount rate', () => {
      const result = calculateDDMValuation(1, 0.1, 0.08);
      expect(result).toHaveProperty('error');
    });

    it('should calculate single stage DDM', () => {
      const result = calculateDDMValuation(1, 0.03, 0.08) as any;
      expect(result.method).toBe('ddm_single_stage');
      expect(result.intrinsic_value).toBeGreaterThan(0);
      expect(result.range_low).toBeLessThan(result.range_high);
    });

    it('should calculate multi stage DDM', () => {
      const result = calculateDDMValuation(1, 0.05, 0.1, [0.08, 0.05]) as any;
      expect(result.method).toBe('ddm_multi_stage');
      expect(result.dividend_forecast.length).toBeGreaterThan(0);
      expect(result.intrinsic_value).toBeGreaterThan(0);
    });
  });

  describe('calculatePEGValuation', () => {
    it('should return error when EPS is not positive', () => {
      const result = calculatePEGValuation(0, 20, 0.2);
      expect(result).toHaveProperty('error');
    });

    it('should return error when growth rate is not positive', () => {
      const result = calculatePEGValuation(10, 20, 0);
      expect(result).toHaveProperty('error');
    });

    it('should identify undervalued stock', () => {
      const result = calculatePEGValuation(10, 15, 0.3) as any;
      expect(result.valuation).toBe('undervalued');
      expect(result.intrinsic_value).toBeGreaterThan(0);
    });

    it('should identify overvalued stock', () => {
      const result = calculatePEGValuation(10, 40, 0.1) as any;
      expect(result.valuation).toBe('overvalued');
    });

    it('should identify fair valued stock', () => {
      const result = calculatePEGValuation(10, 20, 0.2) as any;
      expect(result.valuation).toBe('fair');
    });
  });
});
