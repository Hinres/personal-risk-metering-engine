/**
 * [PRME-INFRA-004] 市场数据 - 估值功能
 * 文件: valuation.controller.ts
 * 需求描述: 股票估值数据查询与估值记录管理
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Stock } from '../models/Stock';
import { FinancialData } from '../models/FinancialData';
import { ValuationRecord } from '../models/ValuationRecord';
import {
  calculatePEValuation,
  calculatePBValuation,
  calculateDCFValuation,
  calculateDDMValuation,
  calculatePEGValuation,
} from '../calculation/valuation';
import { validateValuationParams, validateSearchKeyword, sendValidationError, validatePageParams } from '../utils/validators';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const stockRepo = () => AppDataSource.getRepository(Stock);
const financialRepo = () => AppDataSource.getRepository(FinancialData);
const valuationRepo = () => AppDataSource.getRepository(ValuationRecord);

// ====== 股票搜索 ======
export const searchStocks = async (req: any, res: Response) => {
  try {
    const { keyword } = req.query;

    // 参数校验精确化
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const trimmedKeyword = keyword.trim();

    const stocks = await stockRepo()
      .createQueryBuilder('s')
      .where('s.symbol LIKE :kw OR s.name LIKE :kw', { kw: `%${trimmedKeyword}%` })
      .andWhere('s.status = :status', { status: 'active' })
      .take(20)
      .getMany();

    return successResponse(res, stocks);
  } catch (error: any) {
    logger.error('Stock search failed', { error: error.message });
    return errorResponse(res, 'Failed to search stocks', 500);
  }
};

export const getStockDetail = async (req: any, res: Response) => {
  try {
    const { symbol } = req.params;
    const stock = await stockRepo().findOne({ where: { symbol } });
    if (!stock) {
      return errorResponse(res, 'Stock not found', 404);
    }

    // 获取最新财务数据
    const latestFinancial = await financialRepo().findOne({
      where: { stock_id: stock.stock_id },
      order: { report_period: 'DESC' },
    });

    return successResponse(res, { stock, latest_financial: latestFinancial });
  } catch (error: any) {
    return errorResponse(res, 'Failed to get stock detail', 500);
  }
};

// ====== 估值计算 ======
export const calculateValuation = async (req: any, res: Response) => {
  try {
    // 参数校验精确化
    const validation = validateValuationParams(req.body);
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const { symbol, method, inputs } = req.body;

    const stock = await stockRepo().findOne({ where: { symbol } });
    if (!stock) {
      return errorResponse(res, 'Stock not found', 404);
    }

    // 获取财务数据用于估值
    const financial = await financialRepo().findOne({
      where: { stock_id: stock.stock_id },
      order: { report_period: 'DESC' },
    });

    const methodEndpoints: Record<string, string> = {
      pe: '/api/v1/valuation/pe',
      pb: '/api/v1/valuation/pb',
      dcf: '/api/v1/valuation/dcf',
      ddm: '/api/v1/valuation/ddm',
      peg: '/api/v1/valuation/peg',
    };

    const endpoint = methodEndpoints[method];
    if (!endpoint) {
      return errorResponse(res, `Unsupported valuation method: ${method}`, 400);
    }

    // 调用内嵌 TypeScript 估值引擎
    const safeInputs = JSON.parse(JSON.stringify(inputs || {}));
    const eps = Number(safeInputs.eps ?? financial?.eps ?? 0);
    const bookValuePerShare = Number(safeInputs.book_value_per_share ?? financial?.book_value_per_share ?? 0);
    const dividendPerShare = Number(safeInputs.dividend_per_share ?? financial?.dividend_per_share ?? 0);
    const freeCashFlow = Number(safeInputs.free_cash_flow ?? financial?.free_cash_flow ?? 0);
    const peRatio = Number(safeInputs.pe_ratio ?? financial?.pe_ratio ?? safeInputs.industry_pe ?? 0);
    const pbRatio = Number(safeInputs.pb_ratio ?? financial?.pb_ratio ?? safeInputs.industry_pb ?? 0);
    const roe = Number(safeInputs.roe ?? financial?.roe ?? 0);
    const growthRate = Number(safeInputs.growth_rate ?? financial?.profit_growth_yoy ?? 0);
    const discountRate = Number(safeInputs.discount_rate ?? 0.10);
    const terminalGrowthRate = Number(safeInputs.terminal_growth_rate ?? 0.03);
    const sharesOutstanding = Number(safeInputs.shares_outstanding ?? 1);
    const netDebt = Number(safeInputs.net_debt ?? 0);
    const riskFreeRate = Number(safeInputs.risk_free_rate ?? 0.03);
    const multiStage = Array.isArray(safeInputs.multi_stage) ? safeInputs.multi_stage : null;
    const growthRates = Array.isArray(safeInputs.growth_rates) ? safeInputs.growth_rates : [growthRate];
    const pegTarget = Number(safeInputs.peg_target ?? 1.0);

    let result: any;
    switch (method) {
      case 'pe': {
        const peResult = calculatePEValuation(eps, peRatio, safeInputs.historical_pe ?? null, growthRate || null, riskFreeRate, 'all');
        if ('error' in peResult) {
          return errorResponse(res, peResult.error, 400);
        }
        result = { ...peResult, method: 'pe' };
        break;
      }
      case 'pb': {
        const pbResult = calculatePBValuation(bookValuePerShare, pbRatio, safeInputs.historical_pb ?? null, roe || null, 'all');
        if ('error' in pbResult) {
          return errorResponse(res, pbResult.error, 400);
        }
        result = { ...pbResult, method: 'pb' };
        break;
      }
      case 'dcf': {
        const dcfResult = calculateDCFValuation(freeCashFlow, growthRates, terminalGrowthRate, discountRate, sharesOutstanding, netDebt);
        if ('error' in dcfResult) {
          return errorResponse(res, dcfResult.error, 400);
        }
        result = dcfResult;
        break;
      }
      case 'ddm': {
        const ddmResult = calculateDDMValuation(dividendPerShare, growthRate, discountRate, multiStage);
        if ('error' in ddmResult) {
          return errorResponse(res, ddmResult.error, 400);
        }
        result = { ...ddmResult, method: multiStage ? 'ddm_multi_stage' : 'ddm_single_stage' };
        break;
      }
      case 'peg': {
        const pegResult = calculatePEGValuation(eps, peRatio, growthRate, pegTarget);
        if ('error' in pegResult) {
          return errorResponse(res, pegResult.error, 400);
        }
        result = pegResult;
        break;
      }
      default:
        return errorResponse(res, `Unsupported valuation method: ${method}`, 400);
    }

    // 统一结果字段，保持与原 Python 引擎返回兼容
    if (!result.intrinsic_value && result.summary) {
      result.intrinsic_value = result.summary.mean_value;
      result.range_low = result.summary.range_low;
      result.range_high = result.summary.range_high;
    } else if (!result.intrinsic_value) {
      result.intrinsic_value = 0;
      result.range_low = 0;
      result.range_high = 0;
    }
    if (!result.assumptions) {
      result.assumptions = safeInputs;
    }
    if (!result.sensitivity_analysis) {
      result.sensitivity_analysis = {};
    }

    // 保存估值记录
    const record = valuationRepo().create({
      stock_id: stock.stock_id,
      user_id: req.user?.user_id || null,
      method,
      inputs,
      result_value: result.intrinsic_value || null,
      result_range_low: result.range_low || null,
      result_range_high: result.range_high || null,
      assumptions: result.assumptions || {},
      sensitivity_analysis: result.sensitivity_analysis || {},
      status: 'completed',
    });
    await valuationRepo().save(record);

    return successResponse(res, {
      ...result,
      valuation_id: record.valuation_id,
      stock: { symbol: stock.symbol, name: stock.name },
    }, 'Valuation calculated successfully');
  } catch (error: any) {
    logger.error('Valuation calculation failed', { error: error.message });
    return errorResponse(res, 'Valuation calculation failed', 500);
  }
};

// ====== 估值历史 ======
export const getValuationHistory = async (req: any, res: Response) => {
  try {
    const { stock_id, method, limit = 50 } = req.query;

    // 参数校验精确化
    const pageValidation = validatePageParams(1, limit);
    if (!pageValidation.valid) {
      return sendValidationError(res, pageValidation);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const where: any = {};
    if (stock_id) where.stock_id = stock_id;
    if (method) where.method = method;

    const history = await valuationRepo().find({
      where,
      order: { created_at: 'DESC' },
      take: safeLimit,
      relations: ['stock'],
    });

    return successResponse(res, history);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch valuation history', 500);
  }
};

// ====== 估值方法列表 ======
export const getValuationMethods = async (req: any, res: Response) => {
  try {
    const methods = [
      {
        id: 'pe',
        name: 'PE市盈率估值',
        description: '基于每股收益(EPS)和市盈率(PE)计算内在价值',
        inputs: ['eps', 'pe_ratio', 'historical_pe', 'growth_rate', 'risk_free_rate'],
      },
      {
        id: 'pb',
        name: 'PB市净率估值',
        description: '基于每股净资产和市净率(PB)计算内在价值',
        inputs: ['book_value_per_share', 'pb_ratio', 'historical_pb', 'roe'],
      },
      {
        id: 'dcf',
        name: 'DCF现金流折现估值',
        description: '基于未来自由现金流折现计算企业价值',
        inputs: ['free_cash_flow', 'growth_rates', 'terminal_growth_rate', 'discount_rate', 'shares_outstanding', 'net_debt'],
      },
      {
        id: 'ddm',
        name: 'DDM股息贴现估值',
        description: '基于股息贴现模型计算内在价值',
        inputs: ['dividend_per_share', 'growth_rate', 'discount_rate', 'multi_stage'],
      },
      {
        id: 'peg',
        name: 'PEG估值',
        description: '基于市盈率相对盈利增长比率计算合理估值',
        inputs: ['eps', 'pe_ratio', 'growth_rate', 'peg_target'],
      },
    ];
    return successResponse(res, { methods });
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch valuation methods', 500);
  }
};
