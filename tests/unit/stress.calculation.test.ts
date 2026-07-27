/**
 * [PRME-CALC-004] calculation/stress 单元测试
 * 测试范围: getScenarios, getScenario, mapSectorToShockKey, calculateStressedPortfolio
 * 最后更新: 2026-06-25
 */
import {
  getScenarios,
  getScenario,
  mapSectorToShockKey,
  calculateStressedPortfolio,
  STRESS_SCENARIOS,
  HoldingInput,
} from '../../src/calculation/stress';

describe('PRME-CALC-004: Stress Test Calculation', () => {
  describe('getScenarios()', () => {
    it('should return all predefined scenarios', () => {
      const scenarios = getScenarios();
      expect(Object.keys(scenarios).length).toBeGreaterThan(0);
      expect(scenarios['2008_financial_crisis']).toBeDefined();
      expect(scenarios['2020_covid_pandemic']).toBeDefined();
    });

    it('should return scenario with name, description and shocks', () => {
      const scenarios = getScenarios();
      const scenario = scenarios['2008_financial_crisis'];
      expect(scenario.name).toBe('2008年金融危机');
      expect(scenario.description).toBeTruthy();
      expect(scenario.shocks).toBeDefined();
      expect(Object.keys(scenario.shocks).length).toBeGreaterThan(0);
    });
  });

  describe('getScenario()', () => {
    it('should return specific scenario by id', () => {
      const scenario = getScenario('trade_war');
      expect(scenario).toBeDefined();
      expect(scenario!.name).toBe('贸易战升级');
    });

    it('should return undefined for unknown scenario', () => {
      const scenario = getScenario('nonexistent');
      expect(scenario).toBeUndefined();
    });
  });

  describe('mapSectorToShockKey()', () => {
    it('should map Chinese sector names to shock keys', () => {
      expect(mapSectorToShockKey('科技')).toBe('tech_sector');
      expect(mapSectorToShockKey('银行')).toBe('financial_sector');
      expect(mapSectorToShockKey('能源')).toBe('energy');
      expect(mapSectorToShockKey('房地产')).toBe('real_estate');
    });

    it('should fallback to industry when sector is not mapped', () => {
      expect(mapSectorToShockKey(null, '科技')).toBe('tech_sector');
      expect(mapSectorToShockKey('未知', '银行')).toBe('financial_sector');
    });

    it('should return default for unmapped sectors', () => {
      expect(mapSectorToShockKey('未知行业')).toBe('default');
      expect(mapSectorToShockKey(null, null)).toBe('default');
    });
  });

  describe('calculateStressedPortfolio()', () => {
    const createHoldings = (): HoldingInput[] => [
      { symbol: 'AAPL', quantity: 100, current_price: 150, sector: '科技', weight: 0.5 },
      { symbol: 'JPM', quantity: 50, current_price: 200, sector: '银行', weight: 0.3 },
      { symbol: 'XOM', quantity: 80, current_price: 100, sector: '能源', weight: 0.2 },
    ];

    it('should calculate stressed portfolio value correctly', () => {
      const holdings = createHoldings();
      const shocks = { tech_sector: -0.30, financial_sector: -0.40, energy: 0.50 };

      const result = calculateStressedPortfolio(holdings, shocks);

      // AAPL: 100 * 150 = 15000, shocked = 15000 * 0.7 = 10500
      // JPM: 50 * 200 = 10000, shocked = 10000 * 0.6 = 6000
      // XOM: 80 * 100 = 8000, shocked = 8000 * 1.5 = 12000
      expect(result.portfolio_value).toBe(33000);
      expect(result.stressed_value).toBeCloseTo(28500, 0);
      expect(result.loss_amount).toBeCloseTo(4500, 0);
    });

    it('should fallback to global_equity shock when sector shock not found', () => {
      const holdings: HoldingInput[] = [
        { symbol: 'UNKNOWN', quantity: 100, current_price: 100, sector: '未知行业' },
      ];
      const shocks = { global_equity: -0.20 };

      const result = calculateStressedPortfolio(holdings, shocks);

      expect(result.asset_results[0].shock_key).toBe('default');
      expect(result.asset_results[0].shock_rate).toBe(-0.20);
    });

    it('should handle empty holdings', () => {
      const result = calculateStressedPortfolio([], { global_equity: -0.10 });

      expect(result.portfolio_value).toBe(0);
      expect(result.stressed_value).toBe(0);
      expect(result.loss_amount).toBe(0);
      expect(result.loss_percentage).toBe(0);
    });

    it('should handle holding with zero or missing current_price', () => {
      const holdings: HoldingInput[] = [
        { symbol: 'AAPL', quantity: 100, current_price: 0 },
        { symbol: 'MSFT', quantity: 50, current_price: undefined as any },
      ];
      const shocks = { default: 0 };
      const result = calculateStressedPortfolio(holdings, shocks);
      expect(result.portfolio_value).toBe(0);
      expect(result.stressed_value).toBe(0);
    });

    it('should fallback to 0 when neither shock key nor global_equity exists', () => {
      const holdings: HoldingInput[] = [
        { symbol: 'AAPL', quantity: 100, current_price: 150, sector: '科技' },
      ];
      const shocks = { unrelated_key: -0.1 };
      const result = calculateStressedPortfolio(holdings, shocks);
      expect(result.asset_results[0].shock_rate).toBe(0);
      expect(result.stressed_value).toBe(result.portfolio_value);
    });

    it('should apply correct shock based on sector mapping', () => {
      const holdings: HoldingInput[] = [
        { symbol: 'TENCENT', quantity: 100, current_price: 300, sector: '科技' },
        { symbol: 'ICBC', quantity: 200, current_price: 50, sector: '银行' },
      ];
      const shocks = STRESS_SCENARIOS['dotcom_bubble'].shocks;

      const result = calculateStressedPortfolio(holdings, shocks);

      expect(result.asset_results[0].shock_key).toBe('tech_sector');
      expect(result.asset_results[1].shock_key).toBe('financial_sector');
    });

    it('should include asset-level results for each holding', () => {
      const holdings = createHoldings();
      const shocks = { tech_sector: -0.10, financial_sector: -0.10, energy: -0.10 };

      const result = calculateStressedPortfolio(holdings, shocks);

      expect(result.asset_results).toHaveLength(3);
      result.asset_results.forEach((ar) => {
        expect(ar.symbol).toBeDefined();
        expect(ar.market_value).toBeGreaterThan(0);
        expect(typeof ar.loss).toBe('number');
      });
    });
  });
});
