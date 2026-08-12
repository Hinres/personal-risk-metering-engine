import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { MarketDataService } from '../services/marketData.service';
import { ComplianceFilter } from '../services/compliance.service';
import { AuditService } from '../services/audit.service';
import {
  riskParityOptimization,
  minimumVarianceOptimization,
  maximumSharpeOptimization,
  meanVarianceOptimization,
} from '../calculation/optimization';
import { covarianceMatrix } from '../calculation/utils';
import { APP_CONFIG } from '../config/app';
import { validateOptimizationParams, sendValidationError } from '../utils/validators';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export const optimizePortfolio = async (req: any, res: Response) => {
  try {
    // 参数校验精确化
    const validation = validateOptimizationParams(req.body);
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const { portfolio_id, method, risk_free_rate = 0.03 } = req.body;
    if (!portfolio_id || !method) {
      return errorResponse(res, 'portfolio_id and method are required', 400);
    }

    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id, user_id: req.user.user_id },
    });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }

    const holdings = await holdingRepo().find({ where: { portfolio_id } });
    if (!holdings.length) {
      return errorResponse(res, 'Portfolio has no holdings', 400);
    }

    // [PRME-PA-003] 获取用户风险偏好并映射为优化约束
    const riskTolerance = await ComplianceFilter.getUserRiskTolerance(req.user.user_id);
    const constraints = ComplianceFilter.mapRiskToleranceToConstraints(riskTolerance);
    logger.info('Optimization risk constraints mapped', {
      userId: req.user.user_id,
      riskTolerance,
      constraints,
    });

    const symbols = holdings.map(h => h.symbol);
    let historicalReturns: number[][];
    try {
      historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
    } catch (marketError: any) {
      const errorMsg = marketError.message?.includes('Insufficient historical data')
        ? `Insufficient historical market data for optimization: ${marketError.message}`
        : 'Failed to load market data for optimization';
      logger.warn('Optimization market data unavailable', {
        userId: req.user.user_id,
        portfolioId: portfolio_id,
        symbols,
        error: marketError.message,
      });
      return errorResponse(res, errorMsg, 400);
    }

    const covMatrix = covarianceMatrix(historicalReturns);

    // 调用内嵌 TypeScript 优化引擎
    let rawResult: any;
    switch (method) {
      case 'risk_parity':
        rawResult = riskParityOptimization(historicalReturns, covMatrix, symbols, null);
        break;
      case 'minimum_variance':
        rawResult = minimumVarianceOptimization(historicalReturns, covMatrix, symbols, constraints.allow_short);
        break;
      case 'maximum_sharpe':
        rawResult = maximumSharpeOptimization(historicalReturns, covMatrix, symbols, risk_free_rate, constraints.allow_short);
        break;
      case 'mean_variance':
        rawResult = meanVarianceOptimization(historicalReturns, covMatrix, symbols, null, null, risk_free_rate);
        break;
      default:
        return errorResponse(res, `Unsupported optimization method: ${method}`, 400);
    }

    if (rawResult.error) {
      return errorResponse(res, rawResult.error, 500);
    }

    // [PRME-PA-003] 合规过滤：检测投资建议关键词，命中则替换为通用分散化建议
    const compliance = ComplianceFilter.checkAndFilter(rawResult);

    if (compliance.hasInvestmentKeywords) {
      logger.warn('Optimization result filtered: investment keywords detected', {
        userId: req.user.user_id,
        portfolioId: portfolio_id,
        keywords: compliance.complianceNote,
      });
    }

    // [PRME-PA-003] 包装结果：添加免责声明、风险偏好约束、回测免责声明、预期收益置信区间
    const wrappedResult = ComplianceFilter.wrapResult(
      rawResult,
      req.user.user_id,
      method,
      compliance,
      constraints
    );

    // [PRME-PA-003] 保存优化结果到数据库（含合规记录）
    await ComplianceFilter.saveResult(
      req.user.user_id,
      portfolio_id,
      method,
      rawResult,
      wrappedResult,
      compliance,
      constraints
    );

    // 审计日志
    await AuditService.log('OPTIMIZE', 'optimization_results', portfolio_id, {
      method,
      risk_tolerance: riskTolerance,
      has_investment_keywords: compliance.hasInvestmentKeywords,
    }, {
      userId: req.user?.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, wrappedResult, 'Portfolio optimization completed');
  } catch (error: any) {
    logger.error('Portfolio optimization failed', { error: error.message, userId: req.user?.user_id });
    return errorResponse(res, 'Portfolio optimization failed', 500);
  }
};

export const getOptimizationMethods = async (req: any, res: Response) => {
  try {
    const methods = [
      {
        id: 'risk_parity',
        name: '风险平价',
        description: '使各资产对组合风险贡献相等的配置策略',
      },
      {
        id: 'minimum_variance',
        name: '最小方差',
        description: '在给定收益率下最小化组合波动率的配置策略',
      },
      {
        id: 'maximum_sharpe',
        name: '最大夏普比率',
        description: '最大化风险调整后收益的优化配置策略',
      },
      {
        id: 'mean_variance',
        name: '均值-方差优化',
        description: '基于Markowitz均值方差模型的有效前沿优化',
      },
    ];
    return successResponse(res, { methods });
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch optimization methods', 500);
  }
};
