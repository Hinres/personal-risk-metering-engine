/**
 * [PRME-INFRA-006] 基础设施
 * 文件: validators.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { successResponse, errorResponse } from './response';
import { Response } from 'express';

// ==================== 通用常量 ====================
export const VALID_VAR_METHODS = ['historical', 'parametric', 'monte_carlo', 'extreme_value'];
export const MIN_CONFIDENCE = 0.90;
export const MAX_CONFIDENCE = 0.9999;
export const MIN_TIME_HORIZON = 1;
export const MAX_TIME_HORIZON = 365;
export const VALID_MONITOR_TYPES = ['var_threshold', 'drawdown', 'concentration', 'volatility', 'liquidity'];
export const VALID_MONITOR_OPERATORS = ['>', '<', '>=', '<=', '='];
export const VALID_SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];
export const VALID_MONITOR_RULE_SEVERITY_LEVELS = ['high', 'medium', 'low'];
export const VALID_REPORT_TYPES = ['risk_summary', 'var_analysis', 'stress_test', 'portfolio_review', 'compliance'];
export const VALID_REPORT_FORMATS = ['pdf', 'excel'];
export const VALID_VALUATION_METHODS = ['pe', 'pb', 'dcf', 'ddm', 'peg'];
export const VALID_OPTIMIZATION_METHODS = ['risk_parity', 'minimum_variance', 'maximum_sharpe', 'mean_variance'];
export const VALID_STRESS_SCENARIO_TYPES = ['historical', 'hypothetical', 'custom'];
export const MAX_PORTFOLIO_NAME_LENGTH = 100;
export const MAX_HOLDING_SYMBOL_LENGTH = 20;
export const MAX_MONITOR_NAME_LENGTH = 100;
export const MAX_REPORT_DESCRIPTION_LENGTH = 500;
export const MAX_KEYWORD_LENGTH = 50;
export const MIN_RISK_FREE_RATE = 0;
export const MAX_RISK_FREE_RATE = 0.5;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;

// ==================== 校验结果类型 ====================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ValidatorFn = (params: any) => ValidationResult;

// ==================== 通用校验函数 ====================
export function validateStringField(value: any, fieldName: string, options?: { required?: boolean; minLength?: number; maxLength?: number; trim?: boolean }): string | null {
  const { required = true, minLength = 1, maxLength, trim = true } = options || {};
  if (value === undefined || value === null || value === '') {
    if (required) return `${fieldName} is required`;
    return null;
  }
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  const processed = trim ? value.trim() : value;
  if (processed.length < minLength) return `${fieldName} must be at least ${minLength} characters`;
  if (maxLength !== undefined && processed.length > maxLength) return `${fieldName} must be at most ${maxLength} characters`;
  return null;
}

export function validateNumberField(value: any, fieldName: string, options?: { required?: boolean; min?: number; max?: number; integer?: boolean }): string | null {
  const { required = true, min, max, integer = false } = options || {};
  if (value === undefined || value === null || value === '') {
    if (required) return `${fieldName} is required`;
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) return `${fieldName} must be a valid number`;
  if (integer && !Number.isInteger(num)) return `${fieldName} must be an integer`;
  if (min !== undefined && num < min) return `${fieldName} must be >= ${min}`;
  if (max !== undefined && num > max) return `${fieldName} must be <= ${max}`;
  return null;
}

export function validateEnumField(value: any, fieldName: string, validValues: string[], required = true): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) return `${fieldName} is required`;
    return null;
  }
  if (!validValues.includes(value)) return `${fieldName} must be one of: ${validValues.join(', ')}`;
  return null;
}

export function validateArrayField(value: any, fieldName: string, options?: { required?: boolean; minLength?: number; maxLength?: number; itemType?: string }): string | null {
  const { required = true, minLength, maxLength, itemType } = options || {};
  if (value === undefined || value === null) {
    if (required) return `${fieldName} is required`;
    return null;
  }
  if (!Array.isArray(value)) return `${fieldName} must be an array`;
  if (minLength !== undefined && value.length < minLength) return `${fieldName} must have at least ${minLength} items`;
  if (maxLength !== undefined && value.length > maxLength) return `${fieldName} must have at most ${maxLength} items`;
  if (itemType && !value.every(v => typeof v === itemType)) return `${fieldName} items must be of type ${itemType}`;
  return null;
}

export function validateUUID(value: any, fieldName: string, required = true): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (value === undefined || value === null || value === '') {
    if (required) return `${fieldName} is required`;
    return null;
  }
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (!uuidRegex.test(value)) return `${fieldName} must be a valid UUID`;
  return null;
}

export function validatePageParams(page: any, limit: any): ValidationResult {
  const errors: string[] = [];
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || DEFAULT_PAGE_SIZE;
  if (pageNum < 1) errors.push('page must be >= 1');
  if (limitNum < 1) errors.push('limit must be >= 1');
  if (limitNum > MAX_PAGE_SIZE) errors.push(`limit must be <= ${MAX_PAGE_SIZE}`);
  return { valid: errors.length === 0, errors };
}

// ==================== VaR 参数校验 ====================
export function validateVaRParams(params: { confidence_level?: any; time_horizon?: any; method?: any; portfolio_id?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.portfolio_id, 'portfolio_id', { required: true, minLength: 1 });
  if (err1) errors.push(err1);
  const err2 = validateNumberField(params.confidence_level, 'confidence_level', { required: true, min: MIN_CONFIDENCE, max: MAX_CONFIDENCE });
  if (err2) errors.push(err2);
  const err3 = validateNumberField(params.time_horizon, 'time_horizon', { required: true, min: MIN_TIME_HORIZON, max: MAX_TIME_HORIZON, integer: true });
  if (err3) errors.push(err3);
  const err4 = validateEnumField(params.method, 'method', VALID_VAR_METHODS);
  if (err4) errors.push(err4);
  return { valid: errors.length === 0, errors };
}

// ==================== 监控规则参数校验 ====================
export function validateMonitorParams(params: { portfolio_id?: any; monitor_name?: any; config_name?: any; monitor_type?: any; threshold?: any; operator?: any; notification?: any; rules?: any; severity?: any; notification_methods?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.portfolio_id, 'portfolio_id', { required: true, minLength: 1 });
  if (err1) errors.push(err1);
  // ✅ 支持 config_name（PRD 命名）和 monitor_name（兼容旧调用）
  const name = params.config_name || params.monitor_name;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('config_name or monitor_name is required');
  } else if (name.trim().length > MAX_MONITOR_NAME_LENGTH) {
    errors.push(`config_name/monitor_name must be at most ${MAX_MONITOR_NAME_LENGTH} characters`);
  }
  const err3 = validateEnumField(params.monitor_type, 'monitor_type', VALID_MONITOR_TYPES);
  if (err3) errors.push(err3);
  const err4 = validateNumberField(params.threshold, 'threshold', { required: true, min: 0 });
  if (err4) errors.push(err4);
  const err5 = validateEnumField(params.operator, 'operator', VALID_MONITOR_OPERATORS);
  if (err5) errors.push(err5);

  if (params.notification !== undefined && params.notification !== null) {
    if (typeof params.notification !== 'object' || Array.isArray(params.notification)) {
      errors.push('notification must be an object');
    } else if (params.notification.channels !== undefined) {
      const channels = params.notification.channels;
      if (!Array.isArray(channels)) {
        errors.push('notification.channels must be an array');
      } else {
        const validChannels = ['app', 'sms', 'email', 'wechat'];
        const invalid = channels.filter((c: string) => !validChannels.includes(c));
        if (invalid.length > 0) errors.push(`notification.channels contains invalid values: ${invalid.join(', ')}`);
      }
    }
  }

  // REQ-DEC-20260807-001: severity 与 notification_methods 校验
  if (params.severity !== undefined && params.severity !== null && params.severity !== '') {
    const errSeverity = validateEnumField(params.severity, 'severity', VALID_MONITOR_RULE_SEVERITY_LEVELS, false);
    if (errSeverity) errors.push(errSeverity);
  }
  if (params.notification_methods !== undefined && params.notification_methods !== null) {
    if (!Array.isArray(params.notification_methods)) {
      errors.push('notification_methods must be an array');
    } else {
      const validChannels = ['app', 'sms', 'email', 'wechat'];
      const invalid = params.notification_methods.filter((c: string) => !validChannels.includes(c));
      if (invalid.length > 0) errors.push(`notification_methods contains invalid values: ${invalid.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ==================== 组合参数校验 ====================
export function validatePortfolioParams(params: { name?: any; description?: any; type?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.name, 'name', { required: true, minLength: 1, maxLength: MAX_PORTFOLIO_NAME_LENGTH });
  if (err1) errors.push(err1);
  if (params.description !== undefined && params.description !== null) {
    const err2 = validateStringField(params.description, 'description', { required: false, maxLength: 500 });
    if (err2) errors.push(err2);
  }
  if (params.type !== undefined && params.type !== null) {
    const validTypes = ['stock', 'bond', 'fund', 'mixed', 'crypto', 'custom', 'personal'];
    if (!validTypes.includes(params.type)) errors.push(`type must be one of: ${validTypes.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 持仓参数校验 ====================
export function validateHoldingParams(params: { symbol?: any; name?: any; security_type?: any; exchange?: any; quantity?: any; cost_price?: any; sector?: any; industry?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.symbol, 'symbol', { required: true, minLength: 1, maxLength: MAX_HOLDING_SYMBOL_LENGTH });
  if (err1) errors.push(err1);
  const err2 = validateNumberField(params.quantity, 'quantity', { required: true, min: 0.000001 });
  if (err2) errors.push(err2);
  const err3 = validateNumberField(params.cost_price, 'cost_price', { required: true, min: 0 });
  if (err3) errors.push(err3);
  if (params.name !== undefined && params.name !== null) {
    const err4 = validateStringField(params.name, 'name', { required: false, maxLength: 100 });
    if (err4) errors.push(err4);
  }
  if (params.security_type !== undefined && params.security_type !== null) {
    const validTypes = ['stock', 'bond', 'fund', 'etf', 'option', 'future', 'crypto', 'cash'];
    if (!validTypes.includes(params.security_type)) errors.push(`security_type must be one of: ${validTypes.join(', ')}`);
  }
  // ✅ exchange 支持 SSE/SZSE 等交易所代码（大小写不敏感）
  if (params.exchange !== undefined && params.exchange !== null && params.exchange !== '') {
    const validExchanges = ['SSE', 'SZSE', 'SH', 'SZ', 'BJ', 'HKEX', 'NYSE', 'NASDAQ', 'LSE'];
    const upperExchange = String(params.exchange).toUpperCase();
    if (!validExchanges.includes(upperExchange)) {
      errors.push(`exchange must be one of: ${validExchanges.join(', ')} (case-insensitive)`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 压力测试参数校验 ====================
export function validateStressTestParams(params: { portfolio_id?: any; scenario_id?: any; scenario_name?: any; shocks?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.portfolio_id, 'portfolio_id', { required: true, minLength: 1 });
  if (err1) errors.push(err1);

  // SIT-STRESS-003 修复：自定义情景允许不传 scenario_id，自动推断为 'custom'
  const hasShocks = params.shocks !== undefined && params.shocks !== null;
  const err2 = validateStringField(params.scenario_id, 'scenario_id', { required: !hasShocks, minLength: 1 });
  if (err2) errors.push(err2);

  // 如果传了 shocks 但没传 scenario_id，自动补全为 'custom'
  if (hasShocks && !params.scenario_id) {
    params.scenario_id = 'custom';
  }

  if (params.scenario_id === 'custom' && params.shocks !== undefined) {
    if (typeof params.shocks !== 'object' || Array.isArray(params.shocks)) {
      errors.push('shocks must be an object for custom scenario');
    }
  }

  // M-04: 压力测试参数范围校验（设计文档 §2.5.1）
  if (params.shocks !== undefined && params.shocks !== null) {
    if (typeof params.shocks !== 'object' || Array.isArray(params.shocks)) {
      errors.push('shocks must be an object');
    } else {
      // marketDecline: -5% 至 -50% → 范围 [-0.50, -0.05]
      if (params.shocks.marketDecline !== undefined) {
        const md = Number(params.shocks.marketDecline);
        if (isNaN(md) || md < -0.50 || md > -0.05) {
          errors.push('shocks.marketDecline must be between -0.50 and -0.05');
        }
      }
      // singleStockEvents[].impact: -50% 至 +50% → 范围 [-0.50, +0.50]
      if (params.shocks.singleStockEvents !== undefined) {
        if (!Array.isArray(params.shocks.singleStockEvents)) {
          errors.push('shocks.singleStockEvents must be an array');
        } else {
          for (let i = 0; i < params.shocks.singleStockEvents.length; i++) {
            const event = params.shocks.singleStockEvents[i];
            if (event && event.impact !== undefined) {
              const impact = Number(event.impact);
              if (isNaN(impact) || impact < -0.50 || impact > 0.50) {
                errors.push(`shocks.singleStockEvents[${i}].impact must be between -0.50 and +0.50`);
              }
            }
          }
        }
      }
      // macroParams.interestRate: -5% 至 +10% → 范围 [-0.05, +0.10]
      // macroParams.cpi: -5% 至 +20% → 范围 [-0.05, +0.20]
      if (params.shocks.macroParams !== undefined) {
        if (typeof params.shocks.macroParams !== 'object' || Array.isArray(params.shocks.macroParams)) {
          errors.push('shocks.macroParams must be an object');
        } else {
          if (params.shocks.macroParams.interestRate !== undefined) {
            const ir = Number(params.shocks.macroParams.interestRate);
            if (isNaN(ir) || ir < -0.05 || ir > 0.10) {
              errors.push('shocks.macroParams.interestRate must be between -0.05 and +0.10');
            }
          }
          if (params.shocks.macroParams.cpi !== undefined) {
            const cpi = Number(params.shocks.macroParams.cpi);
            if (isNaN(cpi) || cpi < -0.05 || cpi > 0.20) {
              errors.push('shocks.macroParams.cpi must be between -0.05 and +0.20');
            }
          }
        }
      }
    }
  }

  if (params.scenario_name !== undefined && params.scenario_name !== null) {
    const err3 = validateStringField(params.scenario_name, 'scenario_name', { required: false, maxLength: 100 });
    if (err3) errors.push(err3);
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 优化参数校验 ====================
export function validateOptimizationParams(params: { portfolio_id?: any; method?: any; risk_free_rate?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.portfolio_id, 'portfolio_id', { required: true, minLength: 1 });
  if (err1) errors.push(err1);
  const err2 = validateEnumField(params.method, 'method', VALID_OPTIMIZATION_METHODS);
  if (err2) errors.push(err2);
  const err3 = validateNumberField(params.risk_free_rate, 'risk_free_rate', { required: false, min: MIN_RISK_FREE_RATE, max: MAX_RISK_FREE_RATE });
  if (err3) errors.push(err3);
  return { valid: errors.length === 0, errors };
}

// ==================== 报告参数校验 ====================
export function validateReportParams(params: { portfolio_id?: any; report_type?: any; format?: any; description?: any; start_date?: any; end_date?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.portfolio_id, 'portfolio_id', { required: true, minLength: 1 });
  if (err1) errors.push(err1);
  const err2 = validateEnumField(params.report_type, 'report_type', VALID_REPORT_TYPES);
  if (err2) errors.push(err2);
  const err3 = validateEnumField(params.format, 'format', VALID_REPORT_FORMATS);
  if (err3) errors.push(err3);
  if (params.description !== undefined && params.description !== null) {
    const err4 = validateStringField(params.description, 'description', { required: false, maxLength: MAX_REPORT_DESCRIPTION_LENGTH });
    if (err4) errors.push(err4);
  }
  if (params.start_date !== undefined && params.start_date !== null) {
    const d = new Date(params.start_date);
    if (isNaN(d.getTime())) errors.push('start_date must be a valid date');
  }
  if (params.end_date !== undefined && params.end_date !== null) {
    const d = new Date(params.end_date);
    if (isNaN(d.getTime())) errors.push('end_date must be a valid date');
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 估值参数校验 ====================
export function validateValuationParams(params: { symbol?: any; method?: any; inputs?: any }): ValidationResult {
  const errors: string[] = [];
  const err1 = validateStringField(params.symbol, 'symbol', { required: true, minLength: 1, maxLength: MAX_HOLDING_SYMBOL_LENGTH });
  if (err1) errors.push(err1);
  const err2 = validateEnumField(params.method, 'method', VALID_VALUATION_METHODS);
  if (err2) errors.push(err2);
  if (params.inputs !== undefined && params.inputs !== null) {
    if (typeof params.inputs !== 'object' || Array.isArray(params.inputs)) {
      errors.push('inputs must be an object');
    }
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 搜索参数校验 ====================
export function validateSearchKeyword(keyword: any): ValidationResult {
  const errors: string[] = [];
  if (keyword === undefined || keyword === null || keyword === '') {
    errors.push('keyword is required');
  } else if (typeof keyword !== 'string') {
    errors.push('keyword must be a string');
  } else {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) errors.push('keyword cannot be empty');
    if (trimmed.length > MAX_KEYWORD_LENGTH) errors.push(`keyword must be at most ${MAX_KEYWORD_LENGTH} characters`);
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 通知渠道配置校验 ====================
export function validateNotificationChannels(channels: any): ValidationResult {
  const errors: string[] = [];
  const err = validateArrayField(channels, 'channels', { required: true, minLength: 1 });
  if (err) {
    errors.push(err);
  } else {
    const validChannels = ['app', 'sms', 'email', 'wechat'];
    const invalid = channels.filter((c: string) => !validChannels.includes(c));
    if (invalid.length > 0) errors.push(`Invalid channels: ${invalid.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 便捷响应函数 ====================
export function sendValidationError(res: Response, validation: ValidationResult): Response | null {
  if (!validation.valid) {
    return errorResponse(res, validation.errors.join('; '), 400);
  }
  return null;
}

// ==================== 批量校验（用于控制器入口） ====================
export function validateRequestBody(body: any, validators: Array<{ field: string; validator: ValidatorFn }>): ValidationResult {
  const errors: string[] = [];
  for (const { field, validator } of validators) {
    const result = validator(body[field]);
    if (!result.valid) {
      errors.push(...result.errors.map(e => `${field}: ${e}`));
    }
  }
  return { valid: errors.length === 0, errors };
}
