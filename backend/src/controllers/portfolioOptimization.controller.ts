/**
 * [PRME-v1.3-PA-003] 收益优化建议细分
 * 文件: portfolioOptimization.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { PortfolioService } from '../services/portfolio.service';
import { MarketDataService } from '../services/marketData.service';
import { ComplianceFilter } from '../services/compliance.service';
import { OptimizationScenario } from '../models/OptimizationScenario';
import {
  riskParityOptimization,
  minimumVarianceOptimization,
  maximumSharpeOptimization,
  meanVarianceOptimization,
} from '../calculation/optimization';
import { covarianceMatrix } from '../calculation/utils';
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
    let rawResult: any;
    switch (method) {
      case 'risk_parity':
        rawResult = riskParityOptimization(historicalReturns, covMatrix, symbols, null);
        break;
      case 'minimum_variance':
        rawResult = minimumVarianceOptimization(historicalReturns, covMatrix, symbols, false);
        break;
      case 'maximum_sharpe':
        rawResult = maximumSharpeOptimization(historicalReturns, covMatrix, symbols, 0.025, false);
        break;
      case 'mean_variance':
      default:
        rawResult = meanVarianceOptimization(historicalReturns, covMatrix, symbols, null, null, 0.025);
        break;
    }

    if (rawResult.error) return errorResponse(res, rawResult.error, 500);

    const riskMetrics = await PortfolioService.getRiskReturnAnalysis(id, userId);
    const optimizedWeights = rawResult.weights || rawResult.optimized_weights || {};
    const suggestions = symbols.map(symbol => {
      const current = holdings.find(h => h.symbol === symbol);
      const currentWeight = current?.weight ? Number(current.weight) : 0;
      const suggestedWeight = optimizedWeights[symbol] || 0;
      return {
        symbol,
        name: current?.name || symbol,
        current_weight: Number(currentWeight.toFixed(4)),
        suggested_weight: Number(suggestedWeight.toFixed(4)),
        reason: scenario?.description || '基于优化目标计算',
        backtest_return: Number((rawResult.expected_return || 0).toFixed(4)),
        backtest_volatility: Number((rawResult.volatility || 0).toFixed(4)),
      };
    }).filter(s => Math.abs(s.suggested_weight - s.current_weight) > 0.001);

    return successResponse(res, {
      objective,
      disclaimer: '本优化建议仅供参考，不构成投资建议。',
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
      backtest: {
        period: '1y',
        portfolio_return: riskMetrics.total_return,
        optimized_return: Number((rawResult.expected_return || 0).toFixed(4)),
        disclaimer: '历史表现不代表未来收益',
      },
    });
  } catch (error: any) {
    logger.error('Portfolio optimization failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};
