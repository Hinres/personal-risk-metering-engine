/**
 * [PRME-PA-002] Brinson 归因分析
 * 文件: attribution.service.ts
 * 需求描述: T-14 Brinson 归因模型实现（单期归因）
 * 最后更新: 2026-06-19
 */
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import Decimal from 'decimal.js';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export interface BrinsonBenchmark {
  sectors: { [sector: string]: number }; // 基准权重
  returns: { [sector: string]: number }; // 基准各sector收益
}

export interface BrinsonAttributionResult {
  portfolio_return: number;
  benchmark_return: number;
  excess_return: number;
  allocation_effect: number;
  selection_effect: number;
  interaction_effect: number;
  sector_details: BrinsonSectorDetail[];
  currency: string;
  analysis_date: string;
}

export interface BrinsonSectorDetail {
  sector: string;
  portfolio_weight: number;
  benchmark_weight: number;
  weight_diff: number;
  portfolio_return: number;
  benchmark_return: number;
  return_diff: number;
  allocation_effect: number;
  selection_effect: number;
  interaction_effect: number;
  total_effect: number;
}

export class AttributionService {
  /**
   * Brinson 单期归因分析
   * @param portfolioId 组合ID
   * @param userId 用户ID
   * @param benchmark 可选基准配置（不传则使用等权基准）
   */
  static async performBrinsonAttribution(
    portfolioId: string,
    userId: string,
    benchmark?: BrinsonBenchmark
  ): Promise<BrinsonAttributionResult> {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    if (holdings.length === 0) throw new Error('Portfolio has no holdings');

    // 1. 按 sector 聚合
    const sectorData = this.aggregateBySector(holdings);
    const sectors = Object.keys(sectorData);
    const totalValue = Object.values(sectorData).reduce((sum, s) => sum + s.value, 0);

    // 2. 构建基准（如果未提供，使用等权基准）
    const effectiveBenchmark = benchmark || this.buildEqualWeightBenchmark(sectorData);

    // 3. 计算各 sector 的组合权重和收益
    const portfolioWeights: { [sector: string]: number } = {};
    const portfolioReturns: { [sector: string]: number } = {};
    for (const sector of sectors) {
      const sd = sectorData[sector];
      portfolioWeights[sector] = totalValue > 0 ? sd.value / totalValue : 0;
      portfolioReturns[sector] = sd.totalCost > 0 ? (sd.value - sd.totalCost) / sd.totalCost : 0;
    }

    // 4. 计算组合总收益和基准总收益
    const portfolioReturn = Object.keys(portfolioWeights).reduce(
      (sum, s) => sum + portfolioWeights[s] * portfolioReturns[s],
      0
    );

    const benchmarkWeights = effectiveBenchmark.sectors;
    const benchmarkReturns = effectiveBenchmark.returns;
    const benchmarkReturn = Object.keys(benchmarkWeights).reduce(
      (sum, s) => sum + (benchmarkWeights[s] || 0) * (benchmarkReturns[s] || 0),
      0
    );

    // 5. 计算 Brinson 归因效应
    const sectorDetails: BrinsonSectorDetail[] = [];
    let totalAllocation = 0;
    let totalSelection = 0;
    let totalInteraction = 0;

    for (const sector of sectors) {
      const wp = portfolioWeights[sector] || 0;
      const wb = benchmarkWeights[sector] || 0;
      const rp = portfolioReturns[sector] || 0;
      const rb = benchmarkReturns[sector] || 0;

      const weightDiff = wp - wb;
      const returnDiff = rp - rb;

      // Brinson 单期归因公式
      const allocationEffect = weightDiff * (rb - benchmarkReturn);
      const selectionEffect = wb * returnDiff;
      const interactionEffect = weightDiff * returnDiff;
      const totalEffect = allocationEffect + selectionEffect + interactionEffect;

      sectorDetails.push({
        sector,
        portfolio_weight: parseFloat(wp.toFixed(4)),
        benchmark_weight: parseFloat(wb.toFixed(4)),
        weight_diff: parseFloat(weightDiff.toFixed(4)),
        portfolio_return: parseFloat(rp.toFixed(4)),
        benchmark_return: parseFloat(rb.toFixed(4)),
        return_diff: parseFloat(returnDiff.toFixed(4)),
        allocation_effect: parseFloat(allocationEffect.toFixed(4)),
        selection_effect: parseFloat(selectionEffect.toFixed(4)),
        interaction_effect: parseFloat(interactionEffect.toFixed(4)),
        total_effect: parseFloat(totalEffect.toFixed(4)),
      });

      totalAllocation += allocationEffect;
      totalSelection += selectionEffect;
      totalInteraction += interactionEffect;
    }

    // 按总效应绝对值排序
    sectorDetails.sort((a, b) => Math.abs(b.total_effect) - Math.abs(a.total_effect));

    const excessReturn = portfolioReturn - benchmarkReturn;

    logger.info('Brinson attribution completed', {
      portfolioId,
      portfolioReturn: parseFloat(portfolioReturn.toFixed(4)),
      benchmarkReturn: parseFloat(benchmarkReturn.toFixed(4)),
      excessReturn: parseFloat(excessReturn.toFixed(4)),
      allocationEffect: parseFloat(totalAllocation.toFixed(4)),
      selectionEffect: parseFloat(totalSelection.toFixed(4)),
      interactionEffect: parseFloat(totalInteraction.toFixed(4)),
    });

    return {
      portfolio_return: parseFloat(portfolioReturn.toFixed(4)),
      benchmark_return: parseFloat(benchmarkReturn.toFixed(4)),
      excess_return: parseFloat(excessReturn.toFixed(4)),
      allocation_effect: parseFloat(totalAllocation.toFixed(4)),
      selection_effect: parseFloat(totalSelection.toFixed(4)),
      interaction_effect: parseFloat(totalInteraction.toFixed(4)),
      sector_details: sectorDetails,
      currency: (portfolio.settings as any)?.base_currency || 'CNY',
      analysis_date: new Date().toISOString(),
    };
  }

  /**
   * 按 sector 聚合持仓数据
   */
  private static aggregateBySector(holdings: Holding[]): {
    [sector: string]: { value: number; cost: number; totalCost: number };
  } {
    const result: { [sector: string]: { value: number; cost: number; totalCost: number } } = {};

    for (const h of holdings) {
      const sector = h.sector || '未分类';
      const value = parseFloat(h.market_value?.toString() || '0');
      const qty = parseFloat(h.quantity?.toString() || '0');
      const costPrice = parseFloat(h.cost_price?.toString() || '0');
      const totalCost = qty * costPrice;

      if (!result[sector]) {
        result[sector] = { value: 0, cost: 0, totalCost: 0 };
      }
      result[sector].value += value;
      result[sector].totalCost += totalCost;
    }

    return result;
  }

  /**
   * 构建等权基准
   * 各 sector 等权重，基准收益为各 sector 的平均收益
   */
  private static buildEqualWeightBenchmark(
    sectorData: { [sector: string]: { value: number; cost: number; totalCost: number } }
  ): BrinsonBenchmark {
    const sectors = Object.keys(sectorData);
    const sectorCount = sectors.length;
    const equalWeight = 1 / sectorCount;

    const weights: { [sector: string]: number } = {};
    const returns: { [sector: string]: number } = {};

    for (const sector of sectors) {
      weights[sector] = equalWeight;
      const sd = sectorData[sector];
      returns[sector] = sd.totalCost > 0 ? (sd.value - sd.totalCost) / sd.totalCost : 0;
    }

    return { sectors: weights, returns };
  }
}
