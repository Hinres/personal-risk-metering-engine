/**
 * [PRME-VAR-003] 压力测试和情景分析
 * 文件: stress.controller.ts
 * 需求描述: 压力测试和情景分析功能实现 (已内嵌计算引擎，无需外部HTTP调用)
 * 最后更新: 2026-06-17
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { StressTest } from '../models/StressTest';
import { PortfolioService } from '../services/portfolio.service';
import { AuditService } from '../services/audit.service';
import {
  getScenarios as getStressScenarios,
  getScenario,
  calculateStressedPortfolio,
} from '../calculation/stress';
import { validateStressTestParams, sendValidationError } from '../utils/validators';
import { successResponse, errorResponse } from '../utils/response';

const stressRepo = () => AppDataSource.getRepository(StressTest);

export const getScenarios = async (req: any, res: Response) => {
  try {
    const scenarios = getStressScenarios();
    const scenarioList = Object.entries(scenarios).map(([id, s]: [string, any]) => ({
      id,
      name: s.name,
      description: s.description,
    }));
    return successResponse(res, scenarioList);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch scenarios', 500);
  }
};

export const runStressTest = async (req: any, res: Response) => {
  try {
    // 参数校验精确化
    const validation = validateStressTestParams(req.body);
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const { portfolio_id, scenario_id, shocks, parameters } = req.body;
    const portfolio = await PortfolioService.getById(portfolio_id, req.user.user_id);
    if (!portfolio.holdings?.length) {
      return errorResponse(res, 'Portfolio has no holdings', 400);
    }

    const holdingsPayload = portfolio.holdings.map((h: any) => ({
      symbol: h.symbol,
      quantity: Number(h.quantity) || 0,
      current_price: Number(h.current_price) || 0,
      sector: h.sector || null,
      industry: h.industry || null,
      weight: Number(h.weight) || null,
    }));

    // 判断是否为自定义情景：/custom 路径或 scenario_id === 'custom' 且传了 shocks/parameters
    const isCustomPath = req.path && req.path.includes('/custom');
    const isCustom = isCustomPath || (scenario_id === 'custom' && (shocks || parameters)) || (parameters !== undefined && parameters !== null);

    let result: any;
    let scenarioName: string;
    let scenarioType: string;
    if (isCustom) {
      // ✅ 自定义情景：使用传入的 parameters，无需 scenario_id
      const customShocks = parameters || shocks || {};
      // 参数校验：market_shock 必填，范围 -1.0 ~ 1.0
      if (customShocks.market_shock !== undefined) {
        const ms = Number(customShocks.market_shock);
        if (isNaN(ms) || ms < -1.0 || ms > 1.0) {
          return errorResponse(res, 'parameters.market_shock must be between -1.0 and 1.0', 400);
        }
      }
      result = calculateStressedPortfolio(holdingsPayload, customShocks);
      scenarioName = req.body.scenario_name || '自定义情景';
      scenarioType = 'custom';
    } else {
      const scenario = getScenario(scenario_id);
      if (!scenario) {
        return errorResponse(res, 'Scenario not found', 404);
      }
      result = calculateStressedPortfolio(holdingsPayload, scenario.shocks);
      scenarioName = scenario.name;
      scenarioType = 'historical';
    }

    const stressTest = stressRepo().create({
      portfolio_id,
      scenario_name: scenarioName,
      scenario_type: scenarioType,
      portfolio_value: result.portfolio_value,
      stressed_value: result.stressed_value,
      loss_amount: result.loss_amount,
      loss_percentage: result.loss_percentage,
      asset_results: result.asset_results || [],
      risk_changes: result.risk_changes || {},
      test_date: new Date(),
    });
    await stressRepo().save(stressTest);

    await AuditService.log('CALCULATE', 'stress_tests', stressTest.stress_id, {
      portfolio_id, scenario_name: scenarioName, scenario_type: scenarioType,
    }, { userId: req.user.user_id, ipAddress: req.ip });

    return successResponse(res, { ...result, stress_id: stressTest.stress_id, scenario_name: scenarioName, scenario_type: scenarioType }, 'Stress test completed');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getStressHistory = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.query;
    const where: any = {};
    if (portfolio_id) where.portfolio_id = portfolio_id;
    const history = await stressRepo().find({
      where,
      order: { test_date: 'DESC' },
      take: 50,
    });
    return successResponse(res, history);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
