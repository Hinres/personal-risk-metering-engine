/**
 * [PRME-v1.3-PA-001] 历史对比
 * 文件: portfolioSnapshot.service.ts
 * 需求描述: 生成组合快照与历史对比
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { PortfolioService } from './portfolio.service';
import logger from '../utils/logger';

const snapshotRepo = () => AppDataSource.getRepository(PortfolioSnapshot);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export class PortfolioSnapshotService {
  /**
   * 为组合生成当日快照
   */
  static async createSnapshot(portfolioId: string) {
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId } });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    // 本地日期口径（与下方 todayDate 本地零点写入保持一致；UTC 口径在 00:00-08:00 本地窗口会错位导致查重漏判、产生重复快照）
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const today = localDateStr(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localDateStr(tomorrow);

    // 复用组合统计
    await PortfolioService.updateStatistics(portfolioId);
    const stats = portfolio.statistics || {};

    const totalValue = Number(stats.total_value || 0);
    const totalCost = Number(stats.total_cost || 0);
    const totalReturn = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;

    // 资产配置与行业分布
    const assetAllocation: Record<string, number> = { stock: 0, bond: 0, cash: 0, other: 0 };
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      const type = h.security_type || 'stock';
      const value = Number(h.market_value?.toString() || 0) || Number(h.quantity) * Number(h.current_price?.toString() || h.cost_price?.toString() || 0);
      assetAllocation[type] = (assetAllocation[type] || 0) + value;
      const sector = h.sector || '未分类';
      sectorMap[sector] = (sectorMap[sector] || 0) + value;
    });
    for (const key of Object.keys(assetAllocation)) {
      assetAllocation[key] = totalValue > 0 ? Number((assetAllocation[key] / totalValue).toFixed(4)) : 0;
    }
    const sectorAllocation: Record<string, number> = {};
    for (const [sector, value] of Object.entries(sectorMap)) {
      sectorAllocation[sector] = totalValue > 0 ? Number((value / totalValue).toFixed(4)) : 0;
    }

    // 集中度
    const sortedByValue = [...holdings].sort((a, b) => {
      const va = Number(a.market_value?.toString() || 0);
      const vb = Number(b.market_value?.toString() || 0);
      return vb - va;
    });
    const top1Holding = totalValue > 0 && sortedByValue[0]
      ? Number((Number(sortedByValue[0].market_value?.toString() || 0) / totalValue).toFixed(4))
      : 0;
    const top5Value = sortedByValue.slice(0, 5).reduce((sum, h) => sum + Number(h.market_value?.toString() || 0), 0);
    const top5Holdings = totalValue > 0 ? Number((top5Value / totalValue).toFixed(4)) : 0;

    const existing = await snapshotRepo()
      .createQueryBuilder('s')
      .where('s.portfolio_id = :portfolioId', { portfolioId })
      .andWhere('s.snapshot_date >= :today AND s.snapshot_date < :tomorrow', {
        today,
        tomorrow: tomorrowStr,
      })
      .getOne();

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let entity: PortfolioSnapshot;
    if (existing) {
      entity = existing;
    } else {
      entity = snapshotRepo().create({
        portfolio_id: portfolioId,
        snapshot_date: todayDate,
      });
    }

    entity.total_market_value = totalValue;
    entity.total_cost = totalCost;
    entity.total_return = totalReturn;
    entity.cumulative_return = totalReturn;
    entity.asset_allocation = assetAllocation;
    entity.sector_allocation = sectorAllocation;
    entity.holdings_snapshot = holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      quantity: Number(h.quantity),
      cost_price: Number(h.cost_price),
      current_price: h.current_price ? Number(h.current_price) : null,
      market_value: Number(h.market_value?.toString() || 0),
      weight: h.weight ? Number(h.weight) : null,
      sector: h.sector,
    }));

    await snapshotRepo().save(entity);
    return entity;
  }

  /**
   * 获取历史对比
   */
  static async getHistoricalComparison(portfolioId: string, userId: string, period: '3m' | '6m' | '1y' | '2y') {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    // 确保有当前快照
    await this.createSnapshot(portfolioId);

    const daysMap = { '3m': 90, '6m': 180, '1y': 365, '2y': 730 };
    const days = daysMap[period];

    const currentSnapshot = await snapshotRepo().findOne({
      where: { portfolio_id: portfolioId },
      order: { snapshot_date: 'DESC' },
    });

    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().slice(0, 10);

    const history = await snapshotRepo()
      .createQueryBuilder('s')
      .where('s.portfolio_id = :portfolioId', { portfolioId })
      .andWhere('s.snapshot_date >= :startDate', { startDate })
      .orderBy('s.snapshot_date', 'DESC')
      .getMany();

    const current = this.toSnapshotView(currentSnapshot!);
    const historyViews = history.map(h => this.toSnapshotView(h));

    const oldest = historyViews[historyViews.length - 1] || current;
    const totalValueChange = oldest.total_value > 0
      ? Number(((current.total_value - oldest.total_value) / oldest.total_value).toFixed(4))
      : 0;

    const assetAllocationChange: Record<string, number> = {};
    const sectorAllocationChange: Record<string, number> = {};

    const currentAsset = current.asset_allocation || {};
    const oldAsset = oldest.asset_allocation || {};
    for (const key of new Set([...Object.keys(currentAsset), ...Object.keys(oldAsset)])) {
      assetAllocationChange[key] = Number(((currentAsset[key] || 0) - (oldAsset[key] || 0)).toFixed(4));
    }
    const currentSector = current.sector_allocation || {};
    const oldSector = oldest.sector_allocation || {};
    for (const key of new Set([...Object.keys(currentSector), ...Object.keys(oldSector)])) {
      sectorAllocationChange[key] = Number(((currentSector[key] || 0) - (oldSector[key] || 0)).toFixed(4));
    }

    return {
      period,
      current,
      history: historyViews,
      changes: {
        total_value_change: totalValueChange,
        asset_allocation_change: assetAllocationChange,
        sector_allocation_change: sectorAllocationChange,
      },
    };
  }

  private static toSnapshotView(snapshot: PortfolioSnapshot) {
    return {
      snapshot_date: snapshot.snapshot_date,
      total_value: Number(snapshot.total_market_value?.toString() || 0),
      total_cost: Number(snapshot.total_cost?.toString() || 0),
      total_return: snapshot.total_return ? Number(snapshot.total_return) : null,
      annual_return: snapshot.annual_return ? Number(snapshot.annual_return) : null,
      volatility: snapshot.volatility ? Number(snapshot.volatility) : null,
      sharpe_ratio: snapshot.sharpe_ratio ? Number(snapshot.sharpe_ratio) : null,
      sortino_ratio: snapshot.sortino_ratio ? Number(snapshot.sortino_ratio) : null,
      max_drawdown: snapshot.max_drawdown ? Number(snapshot.max_drawdown) : null,
      calmar_ratio: snapshot.calmar_ratio ? Number(snapshot.calmar_ratio) : null,
      treynor_ratio: snapshot.treynor_ratio ? Number(snapshot.treynor_ratio) : null,
      beta: snapshot.beta ? Number(snapshot.beta) : null,
      risk_free_rate: snapshot.risk_free_rate ? Number(snapshot.risk_free_rate) : null,
      asset_allocation: snapshot.asset_allocation || {},
      sector_allocation: snapshot.sector_allocation || {},
    };
  }
}
