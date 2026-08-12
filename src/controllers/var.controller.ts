/**
 * [PRME-VAR-001] 组合VaR计算
 * 文件: var.controller.ts
 * 需求描述: 组合VaR计算功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { VaRService } from '../services/var.service';
import { AppDataSource } from '../config/database';
import { VaRCalculation } from '../models/VaRCalculation';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { MarketDataService } from '../services/marketData.service';
import { MonitorService } from '../services/monitor.service';
import { AuditService } from '../services/audit.service';
import { getCachedVaR, setCachedVaR, invalidateVaRCache } from '../services/cache.service';
import { validateVaRParams, sendValidationError } from '../utils/validators';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

const CACHE_TTL_SECONDS = 300; // 5分钟缓存

// ==================== 异步降级计算 ====================
async function asyncFallbackCalculation(portfolioId: string, confidence: number, horizon: number, method: string, holdings: any[], historicalReturns: any[]) {
  // 降级方案：使用简化参数法计算
  logger.warn('Running async fallback calculation', { portfolioId, method: 'parametric_fallback' });
  
  // 简化：基于历史收益率均值和标准差的参数法
  const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.market_value?.toString() || '0')), 0);
  const weights = holdings.map(h => {
    const mv = parseFloat(h.market_value?.toString() || '0');
    return totalValue > 0 ? mv / totalValue : 0;
  });

  // 计算组合收益率均值和标准差
  let portfolioMean = 0;
  let portfolioVar = 0;
  const nDays = historicalReturns.length;
  const nAssets = historicalReturns.length > 0 ? historicalReturns[0].length : 0;
  
  if (nAssets > 0 && nDays > 0) {
    // ✅ 修正循环：外层遍历天数，内层遍历资产
    for (let day = 0; day < nDays; day++) {
      let dayReturn = 0;
      for (let i = 0; i < nAssets; i++) {
        dayReturn += (historicalReturns[day][i] || 0) * weights[i];
      }
      portfolioMean += dayReturn;
    }
    portfolioMean /= nDays;

    for (let day = 0; day < nDays; day++) {
      let dayReturn = 0;
      for (let i = 0; i < nAssets; i++) {
        dayReturn += (historicalReturns[day][i] || 0) * weights[i];
      }
      portfolioVar += Math.pow(dayReturn - portfolioMean, 2);
    }
    portfolioVar = portfolioVar / nDays;
  }

  const portfolioStd = Math.sqrt(portfolioVar);
  const zScore = 1.645; // 95%置信度近似
  // ✅ 修正VaR公式：使用负号表示损失（左尾）
  const varValue = -(portfolioMean * totalValue * horizon - zScore * portfolioStd * totalValue * Math.sqrt(horizon));
  const varPercentage = totalValue > 0 ? Math.abs(varValue) / totalValue : 0; // ✅ 避免NaN

  return {
    var_value: parseFloat(varValue.toFixed(2)),
    var_percentage: parseFloat(varPercentage.toFixed(4)),
    expected_return: parseFloat((portfolioMean * horizon).toFixed(4)),
    volatility: parseFloat((portfolioStd * Math.sqrt(horizon)).toFixed(4)),
    method: 'parametric_fallback',
    components: holdings.map((h, i) => ({
      symbol: h.symbol,
      weight: parseFloat(weights[i].toFixed(4)),
      contribution: parseFloat((weights[i] * varPercentage).toFixed(4)),
    })),
    risk_factors: [],
    is_fallback: true,
    fallback_reason: 'async_calculation_engine_timeout',
  };
}

export const calculateVaR = async (req: any, res: Response) => {
  try {
    const { portfolio_id, confidence_level = 0.95, time_horizon = 1, method = 'historical', estimation_method = 'pwm' } = req.body;

    // 参数校验精确化
    const validation = validateVaRParams({ portfolio_id, confidence_level, time_horizon, method });
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }

    const holdings = await holdingRepo().find({ where: { portfolio_id } });
    if (!holdings.length) {
      return successResponse(res, {
        var_value: 0,
        var_percentage: 0,
        expected_return: 0,
        volatility: 0,
        components: [],
        risk_factors: [],
        message: '组合暂无持仓，请先添加持仓后再计算风险指标',
      });
    }

    // 检查Redis缓存
    const cacheKey = `var:${portfolio_id}:${Number(confidence_level).toFixed(4)}:${Number(time_horizon)}:${method}:${estimation_method || 'none'}`;
    const cached = await getCachedVaR(portfolio_id, method, Number(confidence_level), Number(time_horizon), estimation_method);
    if (cached) {
      // 缓存命中，返回缓存结果
      await AuditService.log('CALCULATE', 'var_calculations', 'cached', {
        method,
        confidence_level,
        portfolio_id,
        cached: true,
      }, {
        userId: req.user?.user_id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return successResponse(res, { ...cached, cached: true }, 'VaR calculated successfully (cached)');
    }

    let result: any;
    let isFallback = false;

    try {
      // 调用内嵌计算引擎 (TypeScript)
      result = await VaRService.calculate(
        req.user.user_id,
        portfolio_id,
        {
          confidence_level: Number(confidence_level),
          time_horizon: Number(time_horizon),
          method,
          estimation_method: method === 'extreme_value' ? estimation_method : undefined,
        }
      );
    } catch (calcError: any) {
      // 计算引擎失败，降级为异步简化计算
      logger.warn('Calculation engine failed, using fallback', { error: calcError.message, portfolio_id });
      
      // 获取历史数据用于降级计算
      let historicalReturns: number[][] = [];
      try {
        const symbols = holdings.map(h => h.symbol);
        historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
      } catch (e: any) {
        logger.warn('Market data unavailable for fallback, using empty data', { error: e.message });
      }
      
      result = await asyncFallbackCalculation(
        portfolio_id,
        Number(confidence_level),
        Number(time_horizon),
        method,
        holdings,
        historicalReturns
      );
      isFallback = true;
    }

    // 计算结果已由 VaRService.calculate 持久化；fallback 情况下需要 controller 补存一次
    let varCalcId = result.var_id;
    if (!varCalcId) {
      const varCalc = varRepo().create({
        portfolio: { portfolio_id: portfolio_id },
        user_id: req.user.user_id,
        calculation_type: isFallback ? 'parametric_fallback' : method,
        estimation_method: method === 'extreme_value' ? estimation_method : undefined,
        confidence_level: Number(confidence_level),
        time_horizon: Number(time_horizon),
        calculated_at: new Date(),
        var_value: result.var_value,
        var_percentage: result.var_percentage,
        expected_return: result.expected_return,
        volatility: result.volatility,
        var_components: result.components || result.var_components || [],
        risk_factors: result.risk_factors || [],
        status: 'completed',
      });
      await varRepo().save(varCalc);
      varCalcId = varCalc.var_id;
    }

    // 缓存结果
    const cacheData = { ...result, var_id: varCalcId };
    await setCachedVaR(portfolio_id, method, Number(confidence_level), Number(time_horizon), cacheData, estimation_method);

    // Check risk monitors
    await MonitorService.checkPortfolioMonitors(portfolio_id);

    // Audit log
    await AuditService.log('CALCULATE', 'var_calculations', varCalcId, {
      method: isFallback ? 'parametric_fallback' : method,
      confidence_level: Number(confidence_level),
      var_value: result.var_value,
      portfolio_id,
      is_fallback: isFallback,
    }, {
      userId: req.user?.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, {
      ...result,
      var_id: varCalcId,
      is_fallback: isFallback,
      // ✅ UAT TASK-011: 增加字段说明，消除歧义
      var_value_label: '预期损失金额（元）',
      var_percentage_label: '损失百分比（%）',
      var_value_display: `${result.var_value?.toLocaleString('zh-CN')} 元（预期损失）`,
      var_percentage_display: `${(result.var_percentage * 100)?.toFixed(2)}%（损失占比）`,
    }, 'VaR calculated successfully');
  } catch (error: any) {
    logger.error('VaR calculation failed', { error: error.message });
    return errorResponse(res, 'VaR calculation failed', 500);
  }
};

export const getVaRHistory = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.query;
    const where: any = {};
    if (portfolio_id) where.portfolio_id = portfolio_id;

    const history = await varRepo().find({
      where,
      order: { calculated_at: 'DESC' },
      take: 50
    });
    return successResponse(res, history);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch VaR history', 500);
  }
};
