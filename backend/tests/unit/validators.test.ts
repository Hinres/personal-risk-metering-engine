/**
 * [PRME-INFRA-006] 基础设施 - validators 单元测试
 * 测试范围: 所有校验函数
 * 最后更新: 2026-06-20
 */
import {
  VALID_VAR_METHODS, MIN_CONFIDENCE, MAX_CONFIDENCE, MIN_TIME_HORIZON, MAX_TIME_HORIZON,
  VALID_MONITOR_TYPES, VALID_MONITOR_OPERATORS, VALID_SEVERITY_LEVELS, VALID_REPORT_TYPES, VALID_REPORT_FORMATS,
  VALID_VALUATION_METHODS, VALID_OPTIMIZATION_METHODS, VALID_STRESS_SCENARIO_TYPES,
  MAX_PORTFOLIO_NAME_LENGTH, MAX_HOLDING_SYMBOL_LENGTH, MAX_MONITOR_NAME_LENGTH, MAX_REPORT_DESCRIPTION_LENGTH,
  MAX_KEYWORD_LENGTH, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, MIN_RISK_FREE_RATE, MAX_RISK_FREE_RATE,
  validateStringField, validateNumberField, validateEnumField, validateArrayField, validateUUID,
  validatePageParams, validateVaRParams, validateMonitorParams, validatePortfolioParams,
  validateHoldingParams, validateStressTestParams, validateOptimizationParams, validateReportParams,
  validateValuationParams, validateSearchKeyword, validateNotificationChannels, sendValidationError,
  validateRequestBody, ValidationResult, ValidatorFn,
} from '../../src/utils/validators';

// Mock response helper
const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

// ==================== 通用常量测试 ====================
describe('Validator Constants', () => {
  it('should have correct VaR method constants', () => {
    expect(VALID_VAR_METHODS).toEqual(['historical', 'parametric', 'monte_carlo', 'extreme_value']);
    expect(MIN_CONFIDENCE).toBe(0.90);
    expect(MAX_CONFIDENCE).toBe(0.9999);
    expect(MIN_TIME_HORIZON).toBe(1);
    expect(MAX_TIME_HORIZON).toBe(365);
  });

  it('should have correct monitor constants', () => {
    expect(VALID_MONITOR_TYPES).toContain('var_threshold');
    expect(VALID_MONITOR_OPERATORS).toContain('>=');
    expect(VALID_SEVERITY_LEVELS).toContain('critical');
  });

  it('should have correct report constants', () => {
    expect(VALID_REPORT_TYPES).toContain('var_analysis');
    expect(VALID_REPORT_FORMATS).toEqual(['pdf', 'excel']);
  });

  it('should have correct length constants', () => {
    expect(MAX_PORTFOLIO_NAME_LENGTH).toBe(100);
    expect(MAX_HOLDING_SYMBOL_LENGTH).toBe(20);
    expect(MAX_MONITOR_NAME_LENGTH).toBe(100);
    expect(MAX_REPORT_DESCRIPTION_LENGTH).toBe(500);
    expect(MAX_KEYWORD_LENGTH).toBe(50);
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('should have correct risk-free rate constants', () => {
    expect(MIN_RISK_FREE_RATE).toBe(0);
    expect(MAX_RISK_FREE_RATE).toBe(0.5);
  });
});

// ==================== validateStringField ====================
describe('validateStringField', () => {
  it('should pass for valid string', () => {
    expect(validateStringField('hello', 'name')).toBeNull();
  });

  it('should fail for undefined/null/empty with required=true', () => {
    expect(validateStringField(undefined, 'name')).toBe('name is required');
    expect(validateStringField(null, 'name')).toBe('name is required');
    expect(validateStringField('', 'name')).toBe('name is required');
  });

  it('should pass for undefined with required=false', () => {
    expect(validateStringField(undefined, 'name', { required: false })).toBeNull();
  });

  it('should fail for non-string', () => {
    expect(validateStringField(123, 'name')).toBe('name must be a string');
  });

  it('should check minLength', () => {
    expect(validateStringField('ab', 'name', { minLength: 3 })).toBe('name must be at least 3 characters');
  });

  it('should check maxLength', () => {
    expect(validateStringField('a'.repeat(101), 'name', { maxLength: 100 })).toBe('name must be at most 100 characters');
  });

  it('should trim by default and treat whitespace-only as empty (minLength check)', () => {
    expect(validateStringField('  ', 'name', { minLength: 1 })).toBe('name must be at least 1 characters');
  });

  it('should not trim when trim=false and allow whitespace to pass', () => {
    expect(validateStringField('  ', 'name', { trim: false, minLength: 1 })).toBeNull();
  });
});

// ==================== validateNumberField ====================
describe('validateNumberField', () => {
  it('should pass for valid number', () => {
    expect(validateNumberField(10, 'age')).toBeNull();
  });

  it('should pass for valid number string', () => {
    expect(validateNumberField('10', 'age')).toBeNull();
  });

  it('should fail for undefined with required=true', () => {
    expect(validateNumberField(undefined, 'age')).toBe('age is required');
  });

  it('should pass for undefined with required=false', () => {
    expect(validateNumberField(undefined, 'age', { required: false })).toBeNull();
  });

  it('should fail for NaN', () => {
    expect(validateNumberField('abc', 'age')).toBe('age must be a valid number');
  });

  it('should fail for non-integer when integer=true', () => {
    expect(validateNumberField(10.5, 'age', { integer: true })).toBe('age must be an integer');
  });

  it('should check min', () => {
    expect(validateNumberField(5, 'age', { min: 10 })).toBe('age must be >= 10');
  });

  it('should check max', () => {
    expect(validateNumberField(15, 'age', { max: 10 })).toBe('age must be <= 10');
  });
});

// ==================== validateEnumField ====================
describe('validateEnumField', () => {
  it('should pass for valid enum value', () => {
    expect(validateEnumField('historical', 'method', VALID_VAR_METHODS)).toBeNull();
  });

  it('should fail for invalid enum value', () => {
    expect(validateEnumField('invalid', 'method', VALID_VAR_METHODS))
      .toBe(`method must be one of: ${VALID_VAR_METHODS.join(', ')}`);
  });

  it('should fail for undefined with required=true', () => {
    expect(validateEnumField(undefined, 'method', VALID_VAR_METHODS)).toBe('method is required');
  });

  it('should pass for undefined with required=false', () => {
    expect(validateEnumField(undefined, 'method', VALID_VAR_METHODS, false)).toBeNull();
  });
});

// ==================== validateArrayField ====================
describe('validateArrayField', () => {
  it('should pass for valid array', () => {
    expect(validateArrayField([1, 2, 3], 'items')).toBeNull();
  });

  it('should fail for non-array', () => {
    expect(validateArrayField('not-array', 'items')).toBe('items must be an array');
  });

  it('should check minLength', () => {
    expect(validateArrayField([1], 'items', { minLength: 2 })).toBe('items must have at least 2 items');
  });

  it('should check maxLength', () => {
    expect(validateArrayField([1, 2, 3], 'items', { maxLength: 2 })).toBe('items must have at most 2 items');
  });

  it('should check itemType', () => {
    expect(validateArrayField([1, 'a'], 'items', { itemType: 'number' }))
      .toBe('items items must be of type number');
  });

  it('should pass for undefined with required=false', () => {
    expect(validateArrayField(undefined, 'items', { required: false })).toBeNull();
  });
});

// ==================== validateUUID ====================
describe('validateUUID', () => {
  it('should pass for valid UUID', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000', 'id')).toBeNull();
  });

  it('should fail for invalid UUID', () => {
    expect(validateUUID('invalid-uuid', 'id')).toBe('id must be a valid UUID');
  });

  it('should fail for non-string', () => {
    expect(validateUUID(123, 'id')).toBe('id must be a string');
  });

  it('should pass for undefined with required=false', () => {
    expect(validateUUID(undefined, 'id', false)).toBeNull();
  });
});

// ==================== validatePageParams ====================
describe('validatePageParams', () => {
  it('should pass for valid params', () => {
    const result = validatePageParams(1, 10);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should use defaults for undefined', () => {
    const result = validatePageParams(undefined, undefined);
    expect(result.valid).toBe(true);
  });

  it('should coerce page=0 to 1', () => {
    const result = validatePageParams(0, 10);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should coerce limit=0 to DEFAULT_PAGE_SIZE', () => {
    const result = validatePageParams(1, 0);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for limit > MAX_PAGE_SIZE', () => {
    const result = validatePageParams(1, 101);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`limit must be <= ${MAX_PAGE_SIZE}`);
  });
});

// ==================== validateVaRParams ====================
describe('validateVaRParams', () => {
  it('should pass for valid params', () => {
    const result = validateVaRParams({
      portfolio_id: 'portfolio-1',
      confidence_level: 0.95,
      time_horizon: 1,
      method: 'historical',
    });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing portfolio_id', () => {
    const result = validateVaRParams({ confidence_level: 0.95, time_horizon: 1, method: 'historical' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('portfolio_id is required');
  });

  it('should fail for confidence_level < MIN_CONFIDENCE', () => {
    const result = validateVaRParams({
      portfolio_id: 'p1', confidence_level: 0.5, time_horizon: 1, method: 'historical',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`confidence_level must be >= ${MIN_CONFIDENCE}`);
  });

  it('should fail for confidence_level > MAX_CONFIDENCE', () => {
    const result = validateVaRParams({
      portfolio_id: 'p1', confidence_level: 1.0, time_horizon: 1, method: 'historical',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`confidence_level must be <= ${MAX_CONFIDENCE}`);
  });

  it('should fail for time_horizon < MIN_TIME_HORIZON', () => {
    const result = validateVaRParams({
      portfolio_id: 'p1', confidence_level: 0.95, time_horizon: 0, method: 'historical',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`time_horizon must be >= ${MIN_TIME_HORIZON}`);
  });

  it('should fail for time_horizon > MAX_TIME_HORIZON', () => {
    const result = validateVaRParams({
      portfolio_id: 'p1', confidence_level: 0.95, time_horizon: 366, method: 'historical',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`time_horizon must be <= ${MAX_TIME_HORIZON}`);
  });

  it('should fail for invalid method', () => {
    const result = validateVaRParams({
      portfolio_id: 'p1', confidence_level: 0.95, time_horizon: 1, method: 'invalid',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`method must be one of: ${VALID_VAR_METHODS.join(', ')}`);
  });

  it('should collect multiple errors', () => {
    const result = validateVaRParams({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ==================== validateMonitorParams ====================
describe('validateMonitorParams', () => {
  it('should pass for valid params', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'Monitor A', monitor_type: 'var_threshold',
      threshold: 0.05, operator: '>=',
    });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing portfolio_id', () => {
    const result = validateMonitorParams({ monitor_name: 'M', monitor_type: 'var_threshold', threshold: 0.05, operator: '>=' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('portfolio_id is required');
  });

  it('should fail for monitor_name too long', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'a'.repeat(MAX_MONITOR_NAME_LENGTH + 1),
      monitor_type: 'var_threshold', threshold: 0.05, operator: '>=',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`config_name/monitor_name must be at most ${MAX_MONITOR_NAME_LENGTH} characters`);
  });

  it('should fail for invalid monitor_type', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'invalid', threshold: 0.05, operator: '>=',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`monitor_type must be one of: ${VALID_MONITOR_TYPES.join(', ')}`);
  });

  // DEF-V132-001：校验层清单与 service 层支持矩阵对齐（含别名），小程序「VaR 百分比」选项可用
  it('should accept service-layer aliases such as var_percentage (DEF-V132-001)', () => {
    for (const alias of ['var', 'var_percentage', 'cvar', 'es', 'vol', 'mdd', 'hhi']) {
      const result = validateMonitorParams({
        portfolio_id: 'p1', monitor_name: 'M', monitor_type: alias, threshold: 0.05, operator: '>=',
      });
      expect(result.valid).toBe(true);
    }
  });

  it('should fail for negative threshold', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'var_threshold', threshold: -1, operator: '>=',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('threshold must be >= 0');
  });

  it('should fail for invalid operator', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'var_threshold', threshold: 0.05, operator: '!=',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`operator must be one of: ${VALID_MONITOR_OPERATORS.join(', ')}`);
  });

  it('should fail for invalid notification.channels', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'var_threshold', threshold: 0.05, operator: '>=',
      notification: { channels: ['app', 'fax'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('notification.channels contains invalid values: fax');
  });

  it('should fail for non-array notification.channels', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'var_threshold', threshold: 0.05, operator: '>=',
      notification: { channels: 'app' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('notification.channels must be an array');
  });

  it('should fail for non-object notification', () => {
    const result = validateMonitorParams({
      portfolio_id: 'p1', monitor_name: 'M', monitor_type: 'var_threshold', threshold: 0.05, operator: '>=',
      notification: 'app',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('notification must be an object');
  });
});

// ==================== validatePortfolioParams ====================
describe('validatePortfolioParams', () => {
  it('should pass for valid params', () => {
    const result = validatePortfolioParams({ name: 'My Portfolio', type: 'stock' });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing name', () => {
    const result = validatePortfolioParams({ type: 'stock' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });

  it('should fail for name too long', () => {
    const result = validatePortfolioParams({ name: 'a'.repeat(MAX_PORTFOLIO_NAME_LENGTH + 1) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`name must be at most ${MAX_PORTFOLIO_NAME_LENGTH} characters`);
  });

  it('should fail for description too long', () => {
    const result = validatePortfolioParams({ name: 'P', description: 'a'.repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('description must be at most 500 characters');
  });

  it('should fail for invalid type', () => {
    const result = validatePortfolioParams({ name: 'P', type: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('type must be one of: stock, bond, fund, mixed, crypto, custom, personal');
  });

  it('should pass without type and description', () => {
    const result = validatePortfolioParams({ name: 'P' });
    expect(result.valid).toBe(true);
  });
});

// ==================== validateHoldingParams ====================
describe('validateHoldingParams', () => {
  it('should pass for valid params', () => {
    const result = validateHoldingParams({ symbol: 'AAPL', quantity: 100, cost_price: 150.0 });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing symbol', () => {
    const result = validateHoldingParams({ quantity: 100, cost_price: 150 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('symbol is required');
  });

  it('should fail for symbol too long', () => {
    const result = validateHoldingParams({ symbol: 'a'.repeat(MAX_HOLDING_SYMBOL_LENGTH + 1), quantity: 100, cost_price: 150 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`symbol must be at most ${MAX_HOLDING_SYMBOL_LENGTH} characters`);
  });

  it('should fail for quantity < 0.000001', () => {
    const result = validateHoldingParams({ symbol: 'AAPL', quantity: 0, cost_price: 150 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('quantity must be >= 0.000001');
  });

  it('should fail for cost_price < 0', () => {
    const result = validateHoldingParams({ symbol: 'AAPL', quantity: 100, cost_price: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('cost_price must be >= 0');
  });

  it('should fail for invalid security_type', () => {
    const result = validateHoldingParams({ symbol: 'AAPL', quantity: 100, cost_price: 150, security_type: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('security_type must be one of: stock, bond, fund, etf, option, future, crypto, cash');
  });

  it('should fail for name too long', () => {
    const result = validateHoldingParams({ symbol: 'AAPL', quantity: 100, cost_price: 150, name: 'a'.repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name must be at most 100 characters');
  });
});

// ==================== validateStressTestParams ====================
describe('validateStressTestParams', () => {
  it('should pass for valid params', () => {
    const result = validateStressTestParams({ portfolio_id: 'p1', scenario_id: 'scenario-1' });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing portfolio_id', () => {
    const result = validateStressTestParams({ scenario_id: 's1' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('portfolio_id is required');
  });

  it('should fail for missing scenario_id', () => {
    const result = validateStressTestParams({ portfolio_id: 'p1' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('scenario_id is required');
  });

  // SIT-STRESS-003 修复测试：只传 shocks 不传 scenario_id 时自动推断为 'custom'
  it('should auto-set scenario_id to custom when shocks provided without scenario_id (SIT-STRESS-003)', () => {
    const params: any = { portfolio_id: 'p1', shocks: { marketDecline: -0.1 } };
    const result = validateStressTestParams(params);
    expect(result.valid).toBe(true);
    expect(params.scenario_id).toBe('custom');
  });

  it('should allow explicit scenario_id even when shocks provided (SIT-STRESS-003)', () => {
    const params: any = { portfolio_id: 'p1', scenario_id: 'historical', shocks: { marketDecline: -0.1 } };
    const result = validateStressTestParams(params);
    expect(result.valid).toBe(true);
    expect(params.scenario_id).toBe('historical');
  });

  it('should fail for non-object shocks on custom scenario', () => {
    const result = validateStressTestParams({ portfolio_id: 'p1', scenario_id: 'custom', shocks: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks must be an object for custom scenario');
  });

  it('should fail for marketDecline out of range', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { marketDecline: -0.6 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.marketDecline must be between -0.50 and -0.05');
  });

  it('should fail for marketDecline too high (positive)', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { marketDecline: 0.01 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.marketDecline must be between -0.50 and -0.05');
  });

  it('should fail for invalid singleStockEvents impact', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { singleStockEvents: [{ impact: 0.6 }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.singleStockEvents[0].impact must be between -0.50 and +0.50');
  });

  it('should fail for non-array singleStockEvents', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { singleStockEvents: 'bad' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.singleStockEvents must be an array');
  });

  it('should fail for invalid macroParams interestRate', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { macroParams: { interestRate: 0.15 } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.macroParams.interestRate must be between -0.05 and +0.10');
  });

  it('should fail for invalid macroParams cpi', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { macroParams: { cpi: 0.25 } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.macroParams.cpi must be between -0.05 and +0.20');
  });

  it('should fail for non-object macroParams', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: { macroParams: 'bad' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('shocks.macroParams must be an object');
  });

  it('should pass for valid shocks in range', () => {
    const result = validateStressTestParams({
      portfolio_id: 'p1', scenario_id: 'custom', shocks: {
        marketDecline: -0.1,
        singleStockEvents: [{ impact: 0.2 }],
        macroParams: { interestRate: 0.05, cpi: 0.1 },
      },
    });
    expect(result.valid).toBe(true);
  });
});

// ==================== validateOptimizationParams ====================
describe('validateOptimizationParams', () => {
  it('should pass for valid params', () => {
    const result = validateOptimizationParams({ portfolio_id: 'p1', method: 'mean_variance' });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing portfolio_id', () => {
    const result = validateOptimizationParams({ method: 'mean_variance' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('portfolio_id is required');
  });

  it('should fail for invalid method', () => {
    const result = validateOptimizationParams({ portfolio_id: 'p1', method: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`method must be one of: ${VALID_OPTIMIZATION_METHODS.join(', ')}`);
  });

  it('should fail for risk_free_rate out of range', () => {
    const result = validateOptimizationParams({ portfolio_id: 'p1', method: 'mean_variance', risk_free_rate: 0.6 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`risk_free_rate must be <= ${MAX_RISK_FREE_RATE}`);
  });
});

// ==================== validateReportParams ====================
describe('validateReportParams', () => {
  it('should pass for valid params', () => {
    const result = validateReportParams({ portfolio_id: 'p1', report_type: 'var_analysis', format: 'pdf' });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing portfolio_id', () => {
    const result = validateReportParams({ report_type: 'var_analysis', format: 'pdf' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('portfolio_id is required');
  });

  it('should fail for invalid report_type', () => {
    const result = validateReportParams({ portfolio_id: 'p1', report_type: 'invalid', format: 'pdf' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`report_type must be one of: ${VALID_REPORT_TYPES.join(', ')}`);
  });

  it('should fail for invalid format', () => {
    const result = validateReportParams({ portfolio_id: 'p1', report_type: 'var_analysis', format: 'word' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`format must be one of: ${VALID_REPORT_FORMATS.join(', ')}`);
  });

  it('should fail for description too long', () => {
    const result = validateReportParams({
      portfolio_id: 'p1', report_type: 'var_analysis', format: 'pdf', description: 'a'.repeat(MAX_REPORT_DESCRIPTION_LENGTH + 1),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`description must be at most ${MAX_REPORT_DESCRIPTION_LENGTH} characters`);
  });

  it('should fail for invalid start_date', () => {
    const result = validateReportParams({
      portfolio_id: 'p1', report_type: 'var_analysis', format: 'pdf', start_date: 'invalid-date',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('start_date must be a valid date');
  });

  it('should fail for invalid end_date', () => {
    const result = validateReportParams({
      portfolio_id: 'p1', report_type: 'var_analysis', format: 'pdf', end_date: 'invalid-date',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('end_date must be a valid date');
  });
});

// ==================== validateValuationParams ====================
describe('validateValuationParams', () => {
  it('should pass for valid params', () => {
    const result = validateValuationParams({ symbol: 'AAPL', method: 'pe' });
    expect(result.valid).toBe(true);
  });

  it('should fail for missing symbol', () => {
    const result = validateValuationParams({ method: 'pe' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('symbol is required');
  });

  it('should fail for invalid method', () => {
    const result = validateValuationParams({ symbol: 'AAPL', method: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`method must be one of: ${VALID_VALUATION_METHODS.join(', ')}`);
  });

  it('should fail for non-object inputs', () => {
    const result = validateValuationParams({ symbol: 'AAPL', method: 'pe', inputs: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('inputs must be an object');
  });
});

// ==================== validateSearchKeyword ====================
describe('validateSearchKeyword', () => {
  it('should pass for valid keyword', () => {
    const result = validateSearchKeyword('apple');
    expect(result.valid).toBe(true);
  });

  it('should fail for undefined', () => {
    const result = validateSearchKeyword(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('keyword is required');
  });

  it('should fail for non-string', () => {
    const result = validateSearchKeyword(123);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('keyword must be a string');
  });

  it('should fail for empty after trim', () => {
    const result = validateSearchKeyword('   ');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('keyword cannot be empty');
  });

  it('should fail for too long keyword', () => {
    const result = validateSearchKeyword('a'.repeat(MAX_KEYWORD_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`keyword must be at most ${MAX_KEYWORD_LENGTH} characters`);
  });
});

// ==================== validateNotificationChannels ====================
describe('validateNotificationChannels', () => {
  it('should pass for valid channels', () => {
    const result = validateNotificationChannels(['app', 'email']);
    expect(result.valid).toBe(true);
  });

  it('should fail for invalid channel', () => {
    const result = validateNotificationChannels(['app', 'fax']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid channels: fax');
  });

  it('should fail for empty array', () => {
    const result = validateNotificationChannels([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('channels must have at least 1 items');
  });

  it('should fail for non-array', () => {
    const result = validateNotificationChannels('app');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('channels must be an array');
  });
});

// ==================== sendValidationError ====================
describe('sendValidationError', () => {
  it('should return error response when validation fails', () => {
    const res = mockResponse();
    const result = sendValidationError(res, { valid: false, errors: ['field1 error'] });
    expect(result).toBeDefined();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'field1 error',
    }));
  });

  it('should return null when validation passes', () => {
    const res = mockResponse();
    const result = sendValidationError(res, { valid: true, errors: [] });
    expect(result).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should join multiple errors with semicolon', () => {
    const res = mockResponse();
    sendValidationError(res, { valid: false, errors: ['error1', 'error2'] });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'error1; error2',
    }));
  });
});

// ==================== validateRequestBody ====================
describe('validateRequestBody', () => {
  const mockValidator = (value: any): ValidationResult => {
    if (value === undefined || value === null) return { valid: false, errors: ['required'] };
    return { valid: true, errors: [] };
  };

  it('should pass for valid body', () => {
    const result = validateRequestBody({ name: 'test' }, [
      { field: 'name', validator: mockValidator },
    ]);
    expect(result.valid).toBe(true);
  });

  it('should fail for missing field', () => {
    const result = validateRequestBody({}, [
      { field: 'name', validator: mockValidator },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name: required');
  });

  it('should collect multiple field errors', () => {
    const result = validateRequestBody({}, [
      { field: 'name', validator: mockValidator },
      { field: 'email', validator: mockValidator },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name: required');
    expect(result.errors).toContain('email: required');
  });

  it('should pass when all fields valid', () => {
    const result = validateRequestBody({ name: 'test', email: 'test@example.com' }, [
      { field: 'name', validator: mockValidator },
      { field: 'email', validator: mockValidator },
    ]);
    expect(result.valid).toBe(true);
  });
});
