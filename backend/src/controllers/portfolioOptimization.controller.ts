/**
 * [PRME-v1.3-PA-003] 收益优化建议细分
 * 文件: portfolioOptimization.controller.ts
 * 需求描述: 组合优化建议（分目标筛选主路径 + 无基本面数据降级路径）
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §7/§8/§9
 * 最后更新: 2026-09-06
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { PortfolioService } from '../services/portfolio.service';
import { MarketDataService } from '../services/marketData.service';
import { OptimizationScenario } from '../models/OptimizationScenario';
import {
  riskParityOptimization,
  minimumVarianceOptimization,
  maximumSharpeOptimization,
  meanVarianceOptimization,
} from '../calculation/optimization';
import { covarianceMatrix } from '../calculation/utils';
import {
  OptimizationScreening,
  SCREENING_OBJECTIVES,
  OBJECTIVE_METHOD_MAIN,
  OBJECTIVE_WEIGHT_LIMITS,
  ScreeningObjective,
  ScreeningOutcome,
  computeBacktest,
  normalizeWeights,
} from '../calculation/optimizationScreening';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const scenarioRepo = () => AppDataSource.getRepository(OptimizationScenario);

const OBJECTIVE_TO_METHOD: Record<string, string> = {
  risk: 'risk_parity',
  return_high_yield: 'maximum_sharpe',
  return_growth: 'maximum_sharpe',
  return_value: 'mean_variance',
  return_dividend: 'mean_variance',
  balanced: 'mean_variance',
};

const runOptimizer = (method: string, historicalReturns: number[][], covMatrix: number[][], symbols: string[]) => {
  switch (method) {
    case 'risk_parity':
      return riskParityOptimization(historicalReturns, covMatrix, symbols, null);
    case 'minimum_variance':
      return minimumVarianceOptimization(historicalReturns, covMatrix, symbols, false);
    case 'maximum_sharpe':
      return maximumSharpeOptimization(historicalReturns, covMatrix, symbols, 0.025, false);
    case 'mean_variance':
    default:
      return meanVarianceOptimization(historicalReturns, covMatrix, symbols, null, null, 0.025);
  }
};

/** 当前持仓权重（归一化；无有效权重时等权） */
const currentWeightsOf = (holdings: Holding[]): Record<string, number> => {
  const raw: Record<string, number> = {};
  let total = 0;
  for (const h of holdings) {
    const mv = parseFloat((h as any).market_value?.toString() || '0');
    const w = mv > 0 ? mv : parseFloat(h.quantity?.toString() || '0') * parseFloat(h.cost_price?.toString() || '0');
    raw[h.symbol] = w;
    total += w;
  }
  const symbols = Object.keys(raw);
  if (!symbols.length) return {};
  if (total <= 0) {
    const eq = 1 / symbols.length;
    symbols.forEach(s => { raw[s] = eq; });
    return raw;
  }
  symbols.forEach(s => { raw[s] = raw[s] / total; });
  return raw;
};

export const getPortfolioOptimization = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const objective = (req.query.objective as string) || 'risk';

    // B-06: 收益/综合目标已统一由 optimizationConsentMiddleware 检查 optimization_advice 授权
    // 此处保留 objective 校验，不再重复基于 query 参数检查 consent
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) return errorResponse(res, 'Portfolio not found', 404);

    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    if (!holdings.length) return errorResponse(res, 'Portfolio has no holdings', 400);

    const scenario = await scenarioRepo().findOne({ where: { objective: objective as any, is_active: true } });

    // ── PRME-v1.3-PA-003 §7/§8：四收益目标走筛选主路径 ──
    if ((SCREENING_OBJECTIVES as readonly string[]).includes(objective)) {
      const outcome = await OptimizationScreening.screen(holdings, objective as ScreeningObjective);
      if (outcome.applied) {
        return respondScreened(req, res, objective, holdings, scenario, outcome);
      }
      return respondLegacy(req, res, objective, holdings, scenario, {
        applied: false,
        objective,
        universe_size: outcome.universe_size,
        passed_count: outcome.passed_count,
        reason: outcome.reason || 'FUNDAMENTAL_DATA_UNAVAILABLE',
      });
    }

    // risk / balanced 及降级路径：维持现状（仅用户持仓优化）
    return respondLegacy(req, res, objective, holdings, scenario, null);
  } catch (error: any) {
    logger.error('Portfolio optimization failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/** 主路径：在筛选评分后的入选池上优化（§7.1/§7.3） */
async function respondScreened(
  req: any,
  res: Response,
  objective: string,
  holdings: Holding[],
  scenario: OptimizationScenario | null,
  outcome: ScreeningOutcome
) {
  const symbols = [...outcome.scores.keys()];
  let historicalReturns: number[][];
  try {
    historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
  } catch (e: any) {
    logger.warn('Optimization market data unavailable', { error: e.message });
    return errorResponse(res, 'Insufficient historical market data', 400);
  }

  const covMatrix = covarianceMatrix(historicalReturns);
  const rawResult: any = runOptimizer(OBJECTIVE_METHOD_MAIN[outcome.objective], historicalReturns, covMatrix, symbols);
  if (rawResult.error) return errorResponse(res, rawResult.error, 500);

  const candidateBySymbol = new Map(outcome.pool.map(c => [c.symbol, c]));
  const rawWeights = rawResult.weights || rawResult.optimized_weights || {};
  const optimizedWeights = normalizeWeights(
    rawWeights,
    s => candidateBySymbol.get(s)?.industry ?? null,
    OBJECTIVE_WEIGHT_LIMITS[outcome.objective]
  );

  const riskMetrics = await PortfolioService.getRiskReturnAnalysis(req.params.id, req.user.user_id);

  const currentWeights = currentWeightsOf(holdings);
  const suggestions = symbols
    .map(symbol => {
      const candidate = candidateBySymbol.get(symbol);
      const current = holdings.find(h => h.symbol === symbol);
      const currentWeight = current ? (currentWeights[symbol] || 0) : 0;
      const suggestedWeight = optimizedWeights[symbol] || 0;
      return {
        symbol,
        name: (current as any)?.name || candidate?.name || symbol,
        current_weight: Number(currentWeight.toFixed(4)),
        suggested_weight: Number(suggestedWeight.toFixed(4)),
        reason: candidate?.reason || '基于优化目标计算',
        screen_score: candidate?.score !== null && candidate?.score !== undefined
          ? Number(candidate.score.toFixed(4)) : null,
        backtest_return: Number((rawResult.expected_return || 0).toFixed(4)),
        backtest_volatility: Number((rawResult.volatility || 0).toFixed(4)),
      };
    })
    .filter(s => Math.abs(s.suggested_weight - s.current_weight) > 0.001)
    .sort((a, b) => (b.screen_score ?? 0) - (a.screen_score ?? 0));

  return successResponse(res, {
    objective,
    disclaimer: scenario?.disclaimer || '本优化建议仅供参考，不构成投资建议。',
    screening: {
      applied: true,
      objective,
      universe_size: outcome.universe_size,
      passed_count: outcome.passed_count,
    },
    current_metrics: {
      annual_return: riskMetrics.annual_return,
      volatility: riskMetrics.volatility,
      sharpe: riskMetrics.sharpe_ratio,
    },
    optimized_metrics: {
      annual_return: Number((rawResult.expected_return || 0).toFixed(4)),
      volatility: Number((rawResult.volatility || 0).toFixed(4)),
      sharpe: Number((rawResult.sharpe_ratio || 0).toFixed(4)),
    },
    suggestions,
    backtest: computeBacktest(historicalReturns, symbols, currentWeights, optimizedWeights),
  });
}

/** 降级 / 传统路径：仅用户持仓优化（§8 行为 = 现状行为 + screening/data_warning 块） */
async function respondLegacy(
  req: any,
  res: Response,
  objective: string,
  holdings: Holding[],
  scenario: OptimizationScenario | null,
  screening: Record<string, any> | null
) {
  const method = OBJECTIVE_TO_METHOD[objective] || 'mean_variance';
  const symbols = holdings.map(h => h.symbol);
  let historicalReturns: number[][];
  try {
    historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
  } catch (e: any) {
    logger.warn('Optimization market data unavailable', { error: e.message });
    return errorResponse(res, 'Insufficient historical market data', 400);
  }

  const covMatrix = covarianceMatrix(historicalReturns);
  const rawResult: any = runOptimizer(method, historicalReturns, covMatrix, symbols);
  if (rawResult.error) return errorResponse(res, rawResult.error, 500);

  const riskMetrics = await PortfolioService.getRiskReturnAnalysis(req.params.id, req.user.user_id);
  const currentWeights = currentWeightsOf(holdings);
  const optimizedWeights = rawResult.weights || rawResult.optimized_weights || {};
  const suggestions = symbols.map(symbol => {
    const current = holdings.find(h => h.symbol === symbol);
    const currentWeight = current ? (currentWeights[symbol] || 0) : 0;
    const suggestedWeight = optimizedWeights[symbol] || 0;
    return {
      symbol,
      name: (current as any)?.name || symbol,
      current_weight: Number(currentWeight.toFixed(4)),
      suggested_weight: Number(suggestedWeight.toFixed(4)),
      reason: scenario?.description || '基于优化目标计算',
      backtest_return: Number((rawResult.expected_return || 0).toFixed(4)),
      backtest_volatility: Number((rawResult.volatility || 0).toFixed(4)),
    };
  }).filter(s => Math.abs(s.suggested_weight - s.current_weight) > 0.001);

  return successResponse(res, {
    objective,
    disclaimer: scenario?.disclaimer || '本优化建议仅供参考，不构成投资建议。',
    ...(screening ? { screening } : {}),
    ...(screening ? { data_warning: '基本面数据未就绪，本次建议基于价格数据生成' } : {}),
    current_metrics: {
      annual_return: riskMetrics.annual_return,
      volatility: riskMetrics.volatility,
      sharpe: riskMetrics.sharpe_ratio,
    },
    optimized_metrics: {
      annual_return: Number((rawResult.expected_return || 0).toFixed(4)),
      volatility: Number((rawResult.volatility || 0).toFixed(4)),
      sharpe: Number((rawResult.sharpe_ratio || 0).toFixed(4)),
    },
    suggestions,
    backtest: computeBacktest(historicalReturns, symbols, currentWeights, optimizedWeights),
  });
}
