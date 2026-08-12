/**
 * [PRME-CALC-005] 估值计算模块
 * 文件: valuation.ts
 * 需求描述: 实现PE/PB/DCF/DDM/PEG五种估值方法
 * 最后更新: 2026-06-17
 */
import { mean } from './utils';

export interface PEVResult {
  pe_ratio: number;
  intrinsic_value: number;
  label: string;
}

export interface PEVSummary {
  mean_value: number;
  median_value: number;
  range_low: number;
  range_high: number;
}

export interface PEVValuationResult {
  industry_pe?: PEVResult;
  historical_pe?: PEVResult;
  growth_adjusted?: PEVResult & { growth_rate: number };
  summary?: PEVSummary;
}

export interface PBVResult {
  pb_ratio: number;
  intrinsic_value: number;
  label: string;
}

export interface PBVValuationResult {
  industry_pb?: PBVResult;
  historical_pb?: PBVResult;
  roe_adjusted?: PBVResult & { roe: number };
  summary?: PEVSummary;
}

export interface DCFForecast {
  year: number;
  growth_rate: number;
  fcf: number;
  pv: number;
}

export interface DCFValuationResult {
  method: 'dcf';
  assumptions: {
    discount_rate: number;
    terminal_growth_rate: number;
    shares_outstanding: number;
    net_debt: number;
  };
  forecast_period: DCFForecast[];
  terminal_value: number;
  pv_terminal: number;
  total_pv_fcf: number;
  enterprise_value: number;
  equity_value: number;
  intrinsic_value: number;
  range_low: number;
  range_high: number;
  sensitivity_analysis: Record<string, number>;
}

export interface DDMValuationResult {
  method: string;
  dividend_per_share?: number;
  growth_rate?: number;
  discount_rate?: number;
  stages?: number[];
  dividend_forecast?: Array<{ stage: number; year: number; dividend: number; pv: number }>;
  terminal_value?: number;
  pv_terminal?: number;
  intrinsic_value: number;
  range_low: number;
  range_high: number;
}

export interface PEGValuationResult {
  method: 'peg';
  eps: number;
  current_pe: number;
  growth_rate: number;
  current_peg: number;
  peg_target: number;
  fair_pe: number;
  intrinsic_value: number;
  current_implied_price: number;
  valuation: string;
  range_low: number;
  range_high: number;
}

/**
 * PE市盈率估值
 */
export function calculatePEValuation(
  eps: number,
  peRatioIndustry: number,
  peRatioHistorical?: number | null,
  growthRate?: number | null,
  riskFreeRate: number = 0.03,
  method: string = 'all'
): PEVValuationResult | { error: string } {
  if (!eps || eps <= 0) {
    return { error: 'EPS must be positive' };
  }

  const results: PEVValuationResult = {};

  if (method === 'industry' || method === 'all') {
    const priceIndustry = eps * peRatioIndustry;
    results.industry_pe = {
      pe_ratio: peRatioIndustry,
      intrinsic_value: Math.round(priceIndustry * 100) / 100,
      label: `行业平均PE(${peRatioIndustry.toFixed(1)}x)`,
    };
  }

  if (peRatioHistorical && (method === 'historical' || method === 'all')) {
    const priceHistorical = eps * peRatioHistorical;
    results.historical_pe = {
      pe_ratio: peRatioHistorical,
      intrinsic_value: Math.round(priceHistorical * 100) / 100,
      label: `历史平均PE(${peRatioHistorical.toFixed(1)}x)`,
    };
  }

  if (growthRate !== null && growthRate !== undefined && (method === 'growth' || method === 'all')) {
    const peGrowth = Math.max(8.5, growthRate * 100 * 0.8);
    const priceGrowth = eps * peGrowth;
    results.growth_adjusted = {
      pe_ratio: Math.round(peGrowth * 10) / 10,
      intrinsic_value: Math.round(priceGrowth * 100) / 100,
      growth_rate: growthRate,
      label: `增长调整PE(${peGrowth.toFixed(1)}x, 增长率${(growthRate * 100).toFixed(1)}%)`,
    };
  }

  const values = Object.values(results).map((r: any) => r.intrinsic_value).filter(v => v !== undefined);
  if (values.length > 0) {
    results.summary = {
      mean_value: Math.round(mean(values) * 100) / 100,
      median_value: Math.round(median(values) * 100) / 100,
      range_low: Math.round(Math.min(...values) * 0.9 * 100) / 100,
      range_high: Math.round(Math.max(...values) * 1.1 * 100) / 100,
    };
  }

  return results;
}

/**
 * PB市净率估值
 */
export function calculatePBValuation(
  bookValuePerShare: number,
  pbRatioIndustry: number,
  pbRatioHistorical?: number | null,
  roe?: number | null,
  method: string = 'all'
): PBVValuationResult | { error: string } {
  if (!bookValuePerShare || bookValuePerShare <= 0) {
    return { error: 'Book value per share must be positive' };
  }

  const results: PBVValuationResult = {};

  if (method === 'industry' || method === 'all') {
    const priceIndustry = bookValuePerShare * pbRatioIndustry;
    results.industry_pb = {
      pb_ratio: pbRatioIndustry,
      intrinsic_value: Math.round(priceIndustry * 100) / 100,
      label: `行业平均PB(${pbRatioIndustry.toFixed(1)}x)`,
    };
  }

  if (pbRatioHistorical && (method === 'historical' || method === 'all')) {
    const priceHistorical = bookValuePerShare * pbRatioHistorical;
    results.historical_pb = {
      pb_ratio: pbRatioHistorical,
      intrinsic_value: Math.round(priceHistorical * 100) / 100,
      label: `历史平均PB(${pbRatioHistorical.toFixed(1)}x)`,
    };
  }

  if (roe !== null && roe !== undefined && (method === 'roe' || method === 'all')) {
    const discountRate = 0.10;
    const growthRate = 0.03;
    let pbRoe: number;
    if (roe > discountRate) {
      pbRoe = (roe - growthRate) / (discountRate - growthRate);
    } else {
      pbRoe = 1.0;
    }
    pbRoe = Math.max(0.5, Math.min(pbRoe, 5.0));
    const priceRoe = bookValuePerShare * pbRoe;
    results.roe_adjusted = {
      pb_ratio: Math.round(pbRoe * 100) / 100,
      intrinsic_value: Math.round(priceRoe * 100) / 100,
      roe,
      label: `ROE调整PB(${pbRoe.toFixed(2)}x, ROE${(roe * 100).toFixed(1)}%)`,
    };
  }

  const values = Object.values(results).map((r: any) => r.intrinsic_value).filter(v => v !== undefined);
  if (values.length > 0) {
    results.summary = {
      mean_value: Math.round(mean(values) * 100) / 100,
      median_value: Math.round(median(values) * 100) / 100,
      range_low: Math.round(Math.min(...values) * 0.9 * 100) / 100,
      range_high: Math.round(Math.max(...values) * 1.1 * 100) / 100,
    };
  }

  return results;
}

/**
 * DCF现金流折现估值
 */
export function calculateDCFValuation(
  freeCashFlow: number,
  growthRates: number[],
  terminalGrowthRate: number,
  discountRate: number = 0.10,
  sharesOutstanding: number = 1.0,
  netDebt: number = 0.0
): DCFValuationResult | { error: string } {
  if (!freeCashFlow || freeCashFlow <= 0) {
    return { error: 'Free cash flow must be positive' };
  }

  if (!growthRates || growthRates.length === 0) {
    return { error: 'Growth rates are required' };
  }

  if (terminalGrowthRate >= discountRate) {
    return { error: 'Terminal growth rate must be less than discount rate' };
  }

  const pvFcf: DCFForecast[] = [];
  let fcf = freeCashFlow;
  
  for (let year = 0; year < growthRates.length; year++) {
    fcf = fcf * (1 + growthRates[year]);
    const pv = fcf / Math.pow(1 + discountRate, year + 1);
    pvFcf.push({
      year: year + 1,
      growth_rate: Math.round(growthRates[year] * 10000) / 10000,
      fcf: Math.round(fcf * 100) / 100,
      pv: Math.round(pv * 100) / 100,
    });
  }

  const lastFcf = fcf * (1 + terminalGrowthRate);
  const terminalValue = lastFcf / (discountRate - terminalGrowthRate);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, growthRates.length);

  const totalPvFcf = pvFcf.reduce((sum, p) => sum + p.pv, 0);
  const enterpriseValue = totalPvFcf + pvTerminal;
  const equityValue = enterpriseValue - netDebt;
  const intrinsicValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;

  // 敏感性分析
  const sensitivity: Record<string, number> = {};
  for (const dr of [discountRate - 0.02, discountRate, discountRate + 0.02]) {
    for (const tg of [terminalGrowthRate - 0.01, terminalGrowthRate, terminalGrowthRate + 0.01]) {
      if (tg >= dr) continue;
      const tv = lastFcf / (dr - tg);
      const pvtv = tv / Math.pow(1 + dr, growthRates.length);
      const ev = totalPvFcf + pvtv;
      const eq = ev - netDebt;
      const iv = sharesOutstanding > 0 ? eq / sharesOutstanding : 0;
      sensitivity[`dr${Math.round(dr * 100)}_tg${Math.round(tg * 100)}`] = Math.round(iv * 100) / 100;
    }
  }

  const sensValues = Object.values(sensitivity);

  return {
    method: 'dcf',
    assumptions: {
      discount_rate: discountRate,
      terminal_growth_rate: terminalGrowthRate,
      shares_outstanding: sharesOutstanding,
      net_debt: netDebt,
    },
    forecast_period: pvFcf,
    terminal_value: Math.round(terminalValue * 100) / 100,
    pv_terminal: Math.round(pvTerminal * 100) / 100,
    total_pv_fcf: Math.round(totalPvFcf * 100) / 100,
    enterprise_value: Math.round(enterpriseValue * 100) / 100,
    equity_value: Math.round(equityValue * 100) / 100,
    intrinsic_value: Math.round(intrinsicValuePerShare * 100) / 100,
    range_low: sensValues.length > 0 ? Math.round(Math.min(...sensValues) * 100) / 100 : Math.round(intrinsicValuePerShare * 0.8 * 100) / 100,
    range_high: sensValues.length > 0 ? Math.round(Math.max(...sensValues) * 100) / 100 : Math.round(intrinsicValuePerShare * 1.2 * 100) / 100,
    sensitivity_analysis: sensitivity,
  };
}

/**
 * DDM股息贴现估值
 */
export function calculateDDMValuation(
  dividendPerShare: number,
  growthRate: number,
  discountRate: number = 0.10,
  multiStage?: number[] | null
): DDMValuationResult | { error: string } {
  if (!dividendPerShare || dividendPerShare <= 0) {
    return { error: 'Dividend per share must be positive' };
  }

  if (growthRate >= discountRate) {
    return { error: 'Growth rate must be less than discount rate' };
  }

  if (!multiStage || multiStage.length === 0) {
    // 单阶段 Gordon Growth Model
    const intrinsicValue = dividendPerShare * (1 + growthRate) / (discountRate - growthRate);
    return {
      method: 'ddm_single_stage',
      dividend_per_share: dividendPerShare,
      growth_rate: growthRate,
      discount_rate: discountRate,
      intrinsic_value: Math.round(intrinsicValue * 100) / 100,
      range_low: Math.round(intrinsicValue * 0.85 * 100) / 100,
      range_high: Math.round(intrinsicValue * 1.15 * 100) / 100,
    };
  }

  // 多阶段模型
  const pvDividends: Array<{ stage: number; year: number; dividend: number; pv: number }> = [];
  let dps = dividendPerShare;
  let totalYears = 0;

  for (const stageG of multiStage) {
    for (let year = 0; year < 3; year++) {
      dps = dps * (1 + stageG);
      const pv = dps / Math.pow(1 + discountRate, totalYears + year + 1);
      pvDividends.push({
        stage: Math.floor(pvDividends.length / 3) + 1,
        year: totalYears + year + 1,
        dividend: Math.round(dps * 100) / 100,
        pv: Math.round(pv * 100) / 100,
      });
    }
    totalYears += 3;
  }

  const lastG = multiStage[multiStage.length - 1] || 0.02;
  const safeLastG = lastG >= discountRate ? discountRate - 0.01 : lastG;
  const terminalDps = dps * (1 + safeLastG);
  const terminalValue = terminalDps / (discountRate - safeLastG);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, totalYears);

  const totalPv = pvDividends.reduce((sum, d) => sum + d.pv, 0) + pvTerminal;

  return {
    method: 'ddm_multi_stage',
    stages: multiStage,
    discount_rate: discountRate,
    dividend_forecast: pvDividends,
    terminal_value: Math.round(terminalValue * 100) / 100,
    pv_terminal: Math.round(pvTerminal * 100) / 100,
    intrinsic_value: Math.round(totalPv * 100) / 100,
    range_low: Math.round(totalPv * 0.85 * 100) / 100,
    range_high: Math.round(totalPv * 1.15 * 100) / 100,
  };
}

/**
 * PEG估值
 */
export function calculatePEGValuation(
  eps: number,
  peRatio: number,
  growthRate: number,
  pegTarget: number = 1.0
): PEGValuationResult | { error: string } {
  if (!eps || eps <= 0) {
    return { error: 'EPS must be positive' };
  }

  if (!growthRate || growthRate <= 0) {
    return { error: 'Growth rate must be positive for PEG valuation' };
  }

  const currentPeg = peRatio / (growthRate * 100);
  const fairPe = pegTarget * growthRate * 100;
  const fairPrice = eps * fairPe;
  const impliedPrice = currentPeg > 0 ? eps * peRatio : 0;

  let valuation: string;
  if (currentPeg < 0.8) {
    valuation = 'undervalued';
  } else if (currentPeg > 1.2) {
    valuation = 'overvalued';
  } else {
    valuation = 'fair';
  }

  return {
    method: 'peg',
    eps,
    current_pe: peRatio,
    growth_rate: growthRate,
    current_peg: Math.round(currentPeg * 100) / 100,
    peg_target: pegTarget,
    fair_pe: Math.round(fairPe * 10) / 10,
    intrinsic_value: Math.round(fairPrice * 100) / 100,
    current_implied_price: Math.round(impliedPrice * 100) / 100,
    valuation,
    range_low: Math.round(fairPrice * 0.85 * 100) / 100,
    range_high: Math.round(fairPrice * 1.15 * 100) / 100,
  };
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
