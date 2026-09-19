/**
 * [PRME-PA-001] 组合结构分析
 * 文件: portfolio.service.ts
 * 需求描述: 组合结构分析功能实现
 * 最后更新: 2026-06-11
 */
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { HoldingLimit } from '../models/HoldingLimit';
import Decimal from 'decimal.js';
import logger from '../utils/logger';
import { MarketDataService } from './marketData.service';
import { correlationMatrix } from '../calculation/utils';
import { calculateRiskMetrics, calculateBeta, calculateTreynorRatio } from '../calculation/risk';
import { PortfolioAnalytics } from '../models/PortfolioAnalytics';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const holdingLimitRepo = () => AppDataSource.getRepository(HoldingLimit);
const analyticsRepo = () => AppDataSource.getRepository(PortfolioAnalytics);

export interface ProjectedHolding {
  symbol: string;
  quantity: number;
  cost_price: number;
  market_value?: number;
  sector?: string;
  industry?: string;
}

export class PortfolioService {
  /**
   * V2-02（2026-09-19）：赫芬达尔指数 HHI = Σ w_i²（市值权重平方和），0~1。
   * structure 端点与 monitor 集中度指标共用此实现，保证两处数值口径一致。
   * 无持仓或总市值为 0 时返回 0。
   */
  static calculateHHI(holdings: Holding[]): number {
    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.market_value?.toString() || '0'), 0);
    if (totalValue <= 0) return 0;
    let hhi = 0;
    holdings.forEach(h => {
      const w = parseFloat(h.market_value?.toString() || '0') / totalValue;
      hhi += w * w;
    });
    return parseFloat(hhi.toFixed(4));
  }

  static async getAll(userId: string, page = 1, limit = 10) {
    const [portfolios, total] = await portfolioRepo().findAndCount({
      where: { user_id: userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { portfolios, total, page, limit };
  }

  /**
   * 系统任务用：获取所有活跃组合（不限制用户）
   */
  static async getAllPortfolios(page = 1, limit = 1000) {
    const [portfolios, total] = await portfolioRepo().findAndCount({
      where: { status: 'active' },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { portfolios, total, page, limit };
  }

  static async getById(id: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');
    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    // ✅ 价格缺失时添加 warning，市值/权重/盈亏返回 null 而非错误值
    const enrichedHoldings = holdings.map(h => ({
      ...h,
      market_value: h.current_price ? Number(h.quantity) * Number(h.current_price) : null,
      weight: null, // 价格缺失时权重暂不计算
      unrealized_pnl: h.current_price ? (Number(h.current_price) - Number(h.cost_price)) * Number(h.quantity) : null,
      warning: h.current_price ? undefined : '当前价格未获取',
    }));
    return { ...portfolio, holdings: enrichedHoldings };
  }

  static async create(userId: string, data: { name: string; description?: string; type?: string; settings?: any }) {
    const portfolio = portfolioRepo().create({
      user_id: userId,
      name: data.name,
      description: data.description || null,
      type: data.type || 'personal',
      settings: data.settings || {},
    });
    await portfolioRepo().save(portfolio);
    return portfolio;
  }

  static async update(id: string, userId: string, data: Partial<Portfolio>) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');
    Object.assign(portfolio, data);
    await portfolioRepo().save(portfolio);
    return portfolio;
  }

  static async delete(id: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');
    portfolio.status = 'deleted';
    portfolio.deleted_at = new Date();
    await portfolioRepo().save(portfolio);
    return true;
  }

  static async updateStatistics(id: string) {
    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    
    // 有价格数据 = current_price 或 market_value 存在；空持仓视为正常（市值=0）
    const hasPrices = holdings.length === 0 || holdings.some(h => 
      (h.current_price !== null && h.current_price !== undefined) || 
      (h.market_value !== null && h.market_value !== undefined)
    );
    
    let totalValue = new Decimal(0);
    let totalCost = new Decimal(0);
    
    for (const h of holdings) {
      const quantity = new Decimal(h.quantity?.toString() || '0');
      const costPrice = new Decimal(h.cost_price?.toString() || '0');
      
      if (h.current_price !== null && h.current_price !== undefined) {
        // 优先使用 current_price 计算市值
        const marketValue = quantity.times(h.current_price?.toString() || '0');
        totalValue = totalValue.plus(marketValue);
      } else if (h.market_value !== null && h.market_value !== undefined) {
        // fallback 到已保存的 market_value
        totalValue = totalValue.plus(new Decimal(h.market_value?.toString() || '0'));
      }
      totalCost = totalCost.plus(quantity.times(costPrice));
    }
    
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id } });
    if (portfolio) {
      if (hasPrices) {
        const unrealizedPnl = totalValue.minus(totalCost);
        const unrealizedPnlPct = totalCost.gt(0) 
          ? unrealizedPnl.dividedBy(totalCost).toNumber() 
          : 0;
        portfolio.statistics = {
          total_value: totalValue.toNumber(),
          total_cost: totalCost.toNumber(),
          unrealized_pnl: unrealizedPnl.toNumber(),
          unrealized_pnl_pct: unrealizedPnlPct,
          holding_count: holdings.length,
          updated_at: new Date(),
        };
      } else {
        // ✅ fallback：价格缺失时，total_value 为 null，保留 warning
        portfolio.statistics = {
          total_value: null,
          total_cost: totalCost.toNumber(),
          unrealized_pnl: null,
          unrealized_pnl_pct: null,
          holding_count: holdings.length,
          updated_at: new Date(),
          warning: '价格数据未同步，部分指标暂不可用',
        };
      }
      await portfolioRepo().save(portfolio);
    }
  }

  // ==================== 组合结构分析 ====================
  static async getStructureAnalysis(id: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.market_value?.toString() || '0')), 0);

    // 按资产类型分类
    const assetAllocation: Record<string, number> = { stock: 0, bond: 0, cash: 0, other: 0 };
    holdings.forEach(h => {
      const type = h.security_type || 'stock';
      const value = parseFloat(h.market_value?.toString() || '0');
      if (assetAllocation[type] !== undefined) {
        assetAllocation[type] += value;
      } else {
        assetAllocation.other += value;
      }
    });
    for (const key of Object.keys(assetAllocation)) {
      assetAllocation[key] = totalValue > 0 ? parseFloat((assetAllocation[key] / totalValue).toFixed(4)) : 0;
    }

    // 按行业分类
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || '未分类';
      const value = parseFloat(h.market_value?.toString() || '0');
      sectorMap[sector] = (sectorMap[sector] || 0) + value;
    });
    const sectorAllocation = Object.entries(sectorMap)
      .map(([sector, value]) => ({
        sector,
        weight: totalValue > 0 ? parseFloat((value / totalValue).toFixed(4)) : 0,
        value: parseFloat(value.toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value);

    // 地区分布
    const geographicMap: Record<string, number> = {};
    holdings.forEach(h => {
      const region = h.region || '境内';
      const value = parseFloat(h.market_value?.toString() || '0');
      geographicMap[region] = (geographicMap[region] || 0) + value;
    });
    const geographicAllocation: Record<string, number> = {};
    for (const [region, value] of Object.entries(geographicMap)) {
      geographicAllocation[region] = totalValue > 0 ? parseFloat((value / totalValue).toFixed(4)) : 0;
    }

    // 集中度分析
    const sortedHoldings = [...holdings].sort((a, b) =>
      parseFloat(b.market_value?.toString() || '0') - parseFloat(a.market_value?.toString() || '0')
    );
    const top1Value = sortedHoldings.length > 0 ? parseFloat(sortedHoldings[0].market_value?.toString() || '0') : 0;
    const top5Value = sortedHoldings.slice(0, 5).reduce((sum, h) => sum + parseFloat(h.market_value?.toString() || '0'), 0);
    const top1Holding = totalValue > 0 ? parseFloat((top1Value / totalValue).toFixed(4)) : 0;
    const top5Holdings = totalValue > 0 ? parseFloat((top5Value / totalValue).toFixed(4)) : 0;

    // Herfindahl Index (HHI) —— V2-02 抽取共用实现（structure 与 monitor 同口径）
    const hhi = this.calculateHHI(holdings);

    // 相关性矩阵（仅对持仓 >= 2 的组合生成）
    let correlationMatrixResult: { symbols: string[]; matrix: number[][]; source?: string } | null = null;
    if (holdings.length >= 2) {
      const symbols = holdings.map(h => h.symbol);
      try {
        const historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
        const matrix = correlationMatrix(historicalReturns);
        correlationMatrixResult = {
          symbols,
          matrix,
          source: 'calculated',
        };
        logger.info('Correlation matrix from embedded engine', { portfolioId: id });
      } catch (err: any) {
        logger.warn('Embedded correlation matrix failed, fallback to estimated', { portfolioId: id, error: err.message });
        // 回退：同行业相关性高，不同行业相关性低
        const symbols = holdings.map(h => h.symbol);
        const matrix: number[][] = [];
        for (let i = 0; i < symbols.length; i++) {
          const row: number[] = [];
          for (let j = 0; j < symbols.length; j++) {
            if (i === j) {
              row.push(1.0);
            } else {
              const hi = holdings[i];
              const hj = holdings[j];
              const baseCorr = hi.sector === hj.sector ? 0.65 : 0.25;
              row.push(parseFloat(baseCorr.toFixed(2)));
            }
          }
          matrix.push(row);
        }
        correlationMatrixResult = { symbols, matrix, source: 'estimated_fallback' };
      }
    }

    return {
      asset_allocation: assetAllocation,
      sector_allocation: sectorAllocation,
      geographic_allocation: geographicAllocation,
      concentration: {
        top1_holding: top1Holding,
        top5_holdings: top5Holdings,
        herfindahl_index: hhi,
      },
      correlation_matrix: correlationMatrixResult,
      total_value: parseFloat(totalValue.toFixed(2)),
      holding_count: holdings.length,
    };
  }

  // ==================== 风险收益分析 ====================
  static async getRiskReturnAnalysis(id: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.market_value?.toString() || '0')), 0);
    const totalCost = holdings.reduce((sum, h) => {
      const qty = parseFloat(h.quantity?.toString() || '0');
      const cost = parseFloat(h.cost_price?.toString() || '0');
      return sum + (qty * cost);
    }, 0);

    const totalReturn = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;

    // 简化计算：基于持仓成本价和当前价的加权统计
    const weights = holdings.map(h => {
      const mv = parseFloat(h.market_value?.toString() || '0');
      return totalValue > 0 ? mv / totalValue : 0;
    });

    // 简化夏普比率（假设无风险利率 2.5%）
    const riskFreeRate = 0.025;
    const annualReturn = totalReturn * 365; // 假设当前收益为日收益，年化
    // 简化波动率计算
    const volatility = this.calculatePortfolioVolatility(holdings, weights);
    const sharpeRatio = volatility > 0 ? parseFloat(((annualReturn - riskFreeRate) / volatility).toFixed(4)) : 0;

    // 最大回撤（简化，基于成本价和当前价）
    const maxDrawdown = totalCost > 0 && totalValue < totalCost
      ? parseFloat(((totalCost - totalValue) / totalCost).toFixed(4))
      : 0;

    // 各项持仓收益
    const holdingReturns = holdings.map(h => {
      const qty = parseFloat(h.quantity?.toString() || '0');
      const cost = parseFloat(h.cost_price?.toString() || '0');
      const mv = parseFloat(h.market_value?.toString() || '0');
      const costTotal = qty * cost;
      const returnPct = costTotal > 0 ? ((mv - costTotal) / costTotal) : 0;
      return {
        symbol: h.symbol,
        name: h.name,
        return_pct: parseFloat(returnPct.toFixed(4)),
        market_value: parseFloat(mv.toFixed(2)),
        weight: totalValue > 0 ? parseFloat((mv / totalValue).toFixed(4)) : 0,
      };
    }).sort((a, b) => b.return_pct - a.return_pct);

    // 计算更丰富的风险指标
    const riskMetrics = await this.calculatePortfolioRiskMetrics(holdings, weights, totalValue, totalCost);

    return {
      portfolio_id: id,
      total_value: parseFloat(totalValue.toFixed(2)),
      total_cost: parseFloat(totalCost.toFixed(2)),
      total_return: parseFloat(totalReturn.toFixed(4)),
      annual_return: parseFloat(annualReturn.toFixed(4)),
      volatility: parseFloat(riskMetrics.volatility.toFixed(4)),
      sharpe_ratio: parseFloat(riskMetrics.sharpe_ratio.toFixed(4)),
      sortino_ratio: parseFloat(riskMetrics.sortino_ratio.toFixed(4)),
      max_drawdown: parseFloat(riskMetrics.max_drawdown.toFixed(4)),
      calmar_ratio: parseFloat(riskMetrics.calmar_ratio.toFixed(4)),
      beta: parseFloat(riskMetrics.beta.toFixed(4)),
      treynor_ratio: parseFloat(riskMetrics.treynor_ratio.toFixed(4)),
      risk_free_rate: riskFreeRate,
      holding_returns: holdingReturns,
      analysis_date: new Date().toISOString(),
    };
  }

  private static async calculatePortfolioRiskMetrics(holdings: Holding[], weights: number[], totalValue: number, totalCost: number) {
    // 构建基于持仓市值的简化日收益序列
    const returns: number[] = holdings.map((h) => {
      const cost = parseFloat(h.cost_price?.toString() || '0');
      const current = parseFloat(h.current_price?.toString() || '0') || cost;
      if (cost > 0) return (current - cost) / cost;
      return 0;
    });

    const weightedReturns = returns.map((r, i) => r * weights[i]);
    const riskMetrics = calculateRiskMetrics(weightedReturns);

    let volatility = riskMetrics.volatility;
    if (volatility === 0) {
      // fallback：使用原来的加权波动率计算
      volatility = this.calculatePortfolioVolatility(holdings, weights);
    }

    let maxDrawdown = riskMetrics.max_drawdown;
    if (maxDrawdown === 0 && totalCost > 0 && totalValue < totalCost) {
      maxDrawdown = Number(((totalCost - totalValue) / totalCost).toFixed(4));
    }

    // 获取市场收益（沪深300）计算 beta/treynor
    let beta = 1.0;
    let treynor = riskMetrics.sharpe_ratio;
    try {
      const marketHistory = await MarketDataService.getHistory('000300.SH', 252);
      const marketPrices = marketHistory.map(h => parseFloat(h.close_price?.toString() || '0')).reverse();
      if (marketPrices.length >= 2) {
        const marketReturns: number[] = [];
        for (let i = 1; i < marketPrices.length; i++) {
          marketReturns.push((marketPrices[i] - marketPrices[i - 1]) / marketPrices[i - 1]);
        }
        // 截取与组合收益相同长度
        const alignedMarketReturns = marketReturns.slice(0, weightedReturns.length);
        if (alignedMarketReturns.length > 0) {
          beta = calculateBeta(weightedReturns, alignedMarketReturns);
          treynor = calculateTreynorRatio(weightedReturns, alignedMarketReturns, 0.025);
        }
      }
    } catch (e: any) {
      logger.warn('Beta/Treynor calc fallback', { error: e.message });
    }

    return {
      volatility,
      sharpe_ratio: riskMetrics.sharpe_ratio,
      sortino_ratio: riskMetrics.sortino_ratio,
      max_drawdown: maxDrawdown,
      calmar_ratio: riskMetrics.calmar_ratio,
      beta,
      treynor_ratio: treynor,
    };
  }

  private static calculatePortfolioVolatility(holdings: Holding[], weights: number[]): number {
    if (holdings.length === 0) return 0;
    // 简化计算：使用各持仓的历史波动率加权
    const individualVols = holdings.map(h => {
      const cost = parseFloat(h.cost_price?.toString() || '0');
      const current = parseFloat(h.current_price?.toString() || '0');
      if (cost > 0 && current > 0) {
        return Math.abs((current - cost) / cost);
      }
      return 0.05; // 默认5%日波动
    });
    const weightedVol = individualVols.reduce((sum, vol, i) => sum + vol * weights[i], 0);
    return Math.sqrt(weightedVol) * Math.sqrt(252); // 年化
  }

  // ==================== 持仓限制 ====================
  static async createHoldingLimit(portfolioId: string, userId: string, data: {
    limit_type: string;
    target_symbol?: string;
    target_sector?: string;
    max_weight: number;
    max_value?: number;
    action_on_breach?: string;
  }) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const limit = holdingLimitRepo().create({
      portfolio_id: portfolioId,
      user_id: userId,
      limit_type: data.limit_type,
      target_symbol: data.target_symbol || null,
      target_sector: data.target_sector || null,
      max_weight: data.max_weight,
      max_value: data.max_value || null,
      action_on_breach: data.action_on_breach || 'warn',
      is_active: true,
    });
    await holdingLimitRepo().save(limit);
    return limit;
  }

  static async getHoldingLimits(portfolioId: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    return holdingLimitRepo().find({
      where: { portfolio_id: portfolioId, user_id: userId, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  static async updateHoldingLimit(limitId: string, userId: string, data: Partial<HoldingLimit>) {
    const limit = await holdingLimitRepo().findOne({
      where: { limit_id: limitId, user_id: userId },
    });
    if (!limit) throw new Error('Holding limit not found');
    Object.assign(limit, data);
    limit.updated_at = new Date();
    await holdingLimitRepo().save(limit);
    return limit;
  }

  static async deleteHoldingLimit(limitId: string, userId: string) {
    const limit = await holdingLimitRepo().findOne({
      where: { limit_id: limitId, user_id: userId },
    });
    if (!limit) throw new Error('Holding limit not found');
    limit.is_active = false;
    await holdingLimitRepo().save(limit);
    return true;
  }

  /**
   * 检查持仓限制
   * @param projectedHoldings 如果传入，用这些持仓做预测检查（添加/更新前）
   */
  static async checkHoldingLimits(
    portfolioId: string,
    userId: string,
    projectedHoldings?: ProjectedHolding[]
  ) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    // 实际持仓或预测持仓
    const actualHoldings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    const holdings = projectedHoldings
      ? projectedHoldings.map(h => ({
          ...h,
          market_value: h.market_value ?? h.quantity * h.cost_price,
        } as Holding))
      : actualHoldings;

    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat((h.market_value ?? 0).toString()) || 0), 0);

    const limits = await holdingLimitRepo().find({
      where: { portfolio_id: portfolioId, user_id: userId, is_active: true },
    });

    const breaches: any[] = [];
    for (const limit of limits) {
      let currentWeight = 0;
      let currentValue = 0;
      let affectedHoldings: Holding[] = [];

      const limitType = limit.limit_type;
      if ((limitType === 'single_stock' || limitType === 'risk_exposure') && limit.target_symbol) {
        const matched = holdings.filter(h => h.symbol === limit.target_symbol);
        currentValue = matched.reduce((sum, h) => sum + (parseFloat((h.market_value ?? 0).toString()) || 0), 0);
        currentWeight = totalValue > 0 ? currentValue / totalValue : 0;
        affectedHoldings = matched;
      } else if (limitType === 'sector' && limit.target_sector) {
        affectedHoldings = holdings.filter(h => h.sector === limit.target_sector);
        currentValue = affectedHoldings.reduce((sum, h) => sum + (parseFloat((h.market_value ?? 0).toString()) || 0), 0);
        currentWeight = totalValue > 0 ? currentValue / totalValue : 0;
      } else if (limitType === 'total' || limitType === 'total_portfolio') {
        currentValue = totalValue;
        currentWeight = 1;
        affectedHoldings = holdings;
      }

      const weightExceeded = currentWeight > parseFloat(limit.max_weight.toString());
      const valueExceeded = limit.max_value && currentValue > parseFloat(limit.max_value.toString());

      if (weightExceeded || valueExceeded) {
        breaches.push({
          limit_id: limit.limit_id,
          limit_type: limit.limit_type,
          target_symbol: limit.target_symbol,
          target_sector: limit.target_sector,
          max_weight: limit.max_weight,
          max_value: limit.max_value,
          current_weight: parseFloat(currentWeight.toFixed(4)),
          current_value: parseFloat(currentValue.toFixed(2)),
          action_on_breach: limit.action_on_breach,
          is_breached: true,
          affected_holdings: affectedHoldings.map(h => h.symbol),
          projected_total_value: parseFloat(totalValue.toFixed(2)),
        });
      }
    }

    return {
      portfolio_id: portfolioId,
      total_value: parseFloat(totalValue.toFixed(2)),
      holding_count: holdings.length,
      limit_count: limits.length,
      breaches,
      breach_count: breaches.length,
      is_projected: !!projectedHoldings,
    };
  }
}
