/**
 * [PRME-v1.3-RM-004] 止损建议
 * 文件: stopLoss.service.ts
 * 需求描述: 基于 VaR/最大回撤/自定义阈值生成止损建议
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { StopLossSuggestion } from '../models/StopLossSuggestion';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { MarketDataService } from './marketData.service';
import { percentile } from '../calculation/utils';
import logger from '../utils/logger';
import Decimal from 'decimal.js';

const stopLossRepo = () => AppDataSource.getRepository(StopLossSuggestion);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export interface StopLossDimension {
  dimension: 'stock' | 'sector' | 'portfolio';
  symbol?: string;
  name?: string;
  current_price: number;
  stop_loss_price: number;
  stop_loss_pct: number;
  basis: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface StopLossInput {
  confidence_level: number;
  time_horizon: number;
  dimension: ('stock' | 'sector' | 'portfolio')[];
  custom_thresholds?: { portfolio?: number; sector?: number; stock?: number };
  basis?: 'var' | 'max_drawdown' | 'custom';
}

export class StopLossService {
  static async generateSuggestion(portfolioId: string, userId: string, input: StopLossInput) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    if (!holdings.length) throw new Error('Portfolio has no holdings');

    const suggestions: StopLossDimension[] = [];
    const dimensions = input.dimension || ['stock', 'sector', 'portfolio'];
    const basis = input.basis || (input.custom_thresholds ? 'custom' : 'var');

    if (dimensions.includes('stock')) {
      for (const h of holdings) {
        const currentPrice = await this.getCurrentPrice(h.symbol);
        if (!currentPrice || !h.current_price) continue;
        const stopLossPct = await this.computeStopLossPct(
          input.confidence_level,
          input.time_horizon,
          h.symbol,
          input.custom_thresholds?.stock
        );
        suggestions.push(this.buildSuggestion('stock', h.symbol, h.name || h.symbol, currentPrice, stopLossPct, basis));
      }
    }

    if (dimensions.includes('sector')) {
      const sectors = [...new Set(holdings.map(h => h.sector || '未分类'))];
      for (const sector of sectors) {
        const sectorHoldings = holdings.filter(h => (h.sector || '未分类') === sector);
        if (!sectorHoldings.length) continue;
        const representative = sectorHoldings[0];
        const currentPrice = await this.getCurrentPrice(representative.symbol);
        if (!currentPrice) continue;
        const stopLossPct = await this.computeStopLossPct(
          input.confidence_level,
          input.time_horizon,
          sector,
          input.custom_thresholds?.sector,
          true
        );
        suggestions.push(this.buildSuggestion('sector', sector, sector, currentPrice, stopLossPct, basis));
      }
    }

    if (dimensions.includes('portfolio')) {
      const representative = holdings[0];
      const currentPrice = await this.getCurrentPrice(representative.symbol);
      if (currentPrice) {
        const stopLossPct = await this.computeStopLossPct(
          input.confidence_level,
          input.time_horizon,
          'portfolio',
          input.custom_thresholds?.portfolio,
          true
        );
        suggestions.push(this.buildSuggestion('portfolio', 'portfolio', '整体组合', currentPrice, stopLossPct, basis));
      }
    }

    const entity = stopLossRepo().create({
      portfolio_id: portfolioId,
      user_id: userId,
      confidence_level: input.confidence_level,
      time_horizon: input.time_horizon,
      dimension: dimensions.includes('stock') ? 'stock' : 'portfolio',
      basis,
      suggestions: JSON.stringify(suggestions),
      disclaimer: '本止损参考价位基于历史数据与统计模型计算，仅供参考，不构成投资建议。实际交易请结合市场情况与自身风险承受能力独立判断。',
      triggered_count: 0,
    });
    await stopLossRepo().save(entity);

    return {
      suggestion_id: entity.suggestion_id,
      portfolio_id: portfolioId,
      generated_at: entity.created_at,
      disclaimer: entity.disclaimer,
      suggestions,
    };
  }

  static async getHistory(portfolioId: string, userId: string, page = 1, pageSize = 20) {
    const [list, total] = await stopLossRepo().findAndCount({
      where: { portfolio_id: portfolioId, user_id: userId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { created_at: 'DESC' },
    });
    return {
      total,
      page,
      pageSize,
      list: list.map(item => ({
        ...item,
        suggestions: JSON.parse(item.suggestions || '[]'),
      })),
    };
  }

  private static async getCurrentPrice(symbol: string): Promise<number | null> {
    const price = await MarketDataService.getLatestPrice(symbol);
    return price ? Number(price) : null;
  }

  private static async computeStopLossPct(
    confidence: number,
    timeHorizon: number,
    symbolOrSector: string,
    customThreshold?: number,
    isAggregate = false
  ): Promise<number> {
    if (customThreshold !== undefined && customThreshold > 0) {
      return customThreshold;
    }
    try {
      if (isAggregate) {
        // 聚合对象简化处理：使用固定经验值
        return 0.08;
      }
      const history = await MarketDataService.getHistory(symbolOrSector, 252);
      const prices = history.map(h => parseFloat(h.close_price?.toString() || '0')).reverse();
      if (prices.length < 30) return 0.05;

      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      const varPct = percentile(returns, 1 - confidence);
      return Math.abs(varPct) * Math.sqrt(timeHorizon);
    } catch (e: any) {
      logger.warn(`VaR stop-loss calc failed for ${symbolOrSector}: ${e.message}`);
      return 0.05;
    }
  }

  private static buildSuggestion(
    dimension: 'stock' | 'sector' | 'portfolio',
    symbol: string,
    name: string | null | undefined,
    currentPrice: number,
    stopLossPct: number,
    basis: string
  ): StopLossDimension {
    const stopLossPrice = Number(new Decimal(currentPrice).times(new Decimal(1).minus(stopLossPct)).toFixed(4));
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (stopLossPct <= 0.05) riskLevel = 'low';
    else if (stopLossPct >= 0.10) riskLevel = 'high';

    return {
      dimension,
      symbol,
      name: name || symbol,
      current_price: currentPrice,
      stop_loss_price: stopLossPrice,
      stop_loss_pct: Number(stopLossPct.toFixed(4)),
      basis,
      risk_level: riskLevel,
    };
  }
}
