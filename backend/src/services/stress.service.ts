/**
 * [PRME-VAR-003] 压力测试服务
 * 文件: stress.service.ts
 * 需求描述: 封装压力测试计算与持久化，供控制器/导入/定时任务调用
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../config/database';
import { StressTest } from '../models/StressTest';
import { PortfolioService } from './portfolio.service';
import { AuditService } from './audit.service';
import { getScenario, calculateStressedPortfolio } from '../calculation/stress';
import logger from '../utils/logger';

const stressRepo = () => AppDataSource.getRepository(StressTest);

export class StressService {
  /**
   * 对指定组合运行压力测试并持久化结果
   * @param userId 用户ID
   * @param portfolioId 组合ID
   * @param scenarioId 场景ID，默认 '2008_financial_crisis'
   * @returns 压力测试结果
   */
  static async runStressTest(
    userId: string,
    portfolioId: string,
    scenarioId = '2008_financial_crisis'
  ) {
    const portfolio = await PortfolioService.getById(portfolioId, userId);
    if (!portfolio.holdings?.length) {
      return {
        portfolio_value: 0,
        stressed_value: 0,
        loss_amount: 0,
        loss_percentage: 0,
        asset_results: [],
        message: '组合暂无持仓，压力测试无意义',
        portfolio_id: portfolioId,
        scenario_id: scenarioId,
        test_date: new Date().toISOString(),
      };
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const holdingsPayload = portfolio.holdings.map((h: any) => ({
      symbol: h.symbol,
      quantity: Number(h.quantity) || 0,
      current_price: Number(h.current_price || h.cost_price || 0),
      sector: h.sector || null,
      industry: h.industry || null,
      weight: Number(h.weight) || null,
    }));

    const result = calculateStressedPortfolio(holdingsPayload, scenario.shocks);

    const stressTest = stressRepo().create({
      portfolio_id: portfolioId,
      scenario_name: scenario.name,
      scenario_type: 'historical',
      portfolio_value: result.portfolio_value,
      stressed_value: result.stressed_value,
      loss_amount: result.loss_amount,
      loss_percentage: result.loss_percentage,
      asset_results: result.asset_results || [],
      risk_changes: result.shocks_applied || scenario.shocks,
      test_date: new Date(),
    });
    await stressRepo().save(stressTest);

    await AuditService.log(
      'CALCULATE',
      'stress_tests',
      stressTest.stress_id,
      { portfolio_id: portfolioId, scenario_name: scenario.name, scenario_type: 'historical' },
      { userId }
    );

    return {
      ...result,
      stress_id: stressTest.stress_id,
      scenario_name: scenario.name,
      scenario_type: 'historical',
      scenario_id: scenarioId,
      portfolio_id: portfolioId,
      test_date: stressTest.test_date,
    };
  }

  static async getHistory(userId: string, portfolioId?: string, limit = 50) {
    const query: any = portfolioId ? { portfolio_id: portfolioId } : {};
    return stressRepo().find({
      where: query,
      order: { test_date: 'DESC' },
      take: limit,
    });
  }
}
