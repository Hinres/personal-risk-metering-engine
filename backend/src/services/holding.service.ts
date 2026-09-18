/**
 * [PRME-RM-003] 持仓风险管理
 * 文件: holding.service.ts
 * 需求描述: 持仓风险管理功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { Holding } from '../models/Holding';
import { Portfolio } from '../models/Portfolio';
import { PortfolioService } from './portfolio.service';

const holdingRepo = () => AppDataSource.getRepository(Holding);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

/** 兼容 date 列与 metadata 的日期串提取（YYYY-MM-DD 或 null） */
function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export class HoldingService {
  /**
   * 统一持仓序列化（F-01）：列表与详情接口共用。
   * purchase_date 取值顺序：列优先 → metadata 兜底 → null（无日期时返回 null 而非空串）。
   * market / remark 保持原详情接口的顶层展平语义（metadata 键存在即尊重用户清空值）。
   */
  static serializeHolding(h: Holding) {
    const metadata = (h.metadata || {}) as Record<string, any>;
    const has = (k: string) => Object.prototype.hasOwnProperty.call(metadata, k);
    const val = (k: string) => (metadata[k] === null || metadata[k] === undefined ? '' : metadata[k]);
    return {
      ...h,
      market: has('market') ? val('market') : (h.exchange || ''),
      purchase_date: toDateString(h.purchase_date) ?? toDateString(metadata.purchase_date),
      remark: has('remark') ? val('remark') : '',
    };
  }

  /**
   * 归一化前端输入的 metadata 相关字段到 metadata JSON
   * 供 add / update 复用，避免新增/编辑场景字段丢失
   * （F-01：purchase_date 同时双写 holdings.purchase_date 列，读取列优先）
   */
  static normalizeMetadataInput(data: any, existingMetadata: Record<string, any> = {}) {
    const metadata = { ...existingMetadata };
    if (data.purchase_date !== undefined) {
      metadata.purchase_date = data.purchase_date;
    }
    if (data.remark !== undefined) {
      metadata.remark = data.remark;
    }
    if (data.market !== undefined) {
      metadata.market = data.market;
    }
    return metadata;
  }

  /**
   * F-01：purchase_date 列写入规则
   * - 合法 YYYY-MM-DD → 该日期
   * - 空串 / null（前端清空）→ NULL
   * - undefined（未提交该字段）→ 保持现状（返回 undefined 表示不修改）
   */
  static normalizePurchaseDateColumn(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    const s = toDateString(value);
    return s ? new Date(`${s}T00:00:00.000Z`) : null;
  }

  static async getByPortfolio(portfolioId: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');
    return holdingRepo().find({ where: { portfolio_id: portfolioId }, order: { created_at: 'DESC' } });
  }

  /**
   * 按 ID 查询单个持仓（并校验用户权限）
   */
  static async findOne(id: string, userId: string) {
    const holding = await holdingRepo().findOne({ where: { holding_id: id } });
    if (!holding) return null;

    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: holding.portfolio_id, user_id: userId },
    });
    if (!portfolio) return null;

    return holding;
  }

  static async add(portfolioId: string, userId: string, data: any) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    // 尝试从 market_data 获取当前价格
    const { MarketDataService } = await import('./marketData.service');
    let currentPrice = data.current_price || null;
    if (!currentPrice) {
      const latestPrice = await MarketDataService.getLatestPrice(data.symbol);
      if (latestPrice) {
        currentPrice = latestPrice;
      }
    }

    const marketValue = currentPrice ? Number(data.quantity) * Number(currentPrice) : null;
    const metadata = this.normalizeMetadataInput(data);
    const purchaseDate = this.normalizePurchaseDateColumn(data.purchase_date);

    const holding = holdingRepo().create({
      portfolio_id: portfolioId,
      symbol: data.symbol,
      name: data.name || null,
      security_type: data.security_type || 'stock',
      exchange: data.exchange || null,
      quantity: Number(data.quantity),
      cost_price: Number(data.cost_price),
      current_price: currentPrice,
      market_value: marketValue,
      weight: data.weight || null,
      sector: data.sector || null,
      industry: data.industry || null,
      purchase_date: purchaseDate === undefined ? null : purchaseDate,
      metadata,
    });
    await holdingRepo().save(holding);

    // 重新计算组合统计
    await PortfolioService.updateStatistics(portfolioId);

    return holding;
  }

  static async update(id: string, userId: string, data: any, existingHolding?: Holding) {
    const holding = existingHolding || (await this.findOne(id, userId));
    if (!holding) throw new Error('Holding not found');

    // 归一化前端字段到 metadata JSON（add/update 复用同一套映射）
    holding.metadata = this.normalizeMetadataInput(data, holding.metadata || {});

    // F-01：purchase_date 同步写列（undefined 表示未提交，保持列现状）
    const purchaseDateCol = this.normalizePurchaseDateColumn(data.purchase_date);
    if (purchaseDateCol !== undefined) {
      holding.purchase_date = purchaseDateCol;
    }

    delete data.purchase_date;
    delete data.remark;
    delete data.market;

    Object.assign(holding, data);
    await holdingRepo().save(holding);
    return holding;
  }

  static async delete(id: string, userId: string, existingHolding?: Holding) {
    const holding = existingHolding || (await this.findOne(id, userId));
    if (!holding) throw new Error('Holding not found');
    await holdingRepo().remove(holding);
    return true;
  }

  /**
   * 刷新单个持仓价格（从 market_data）
   */
  static async refreshHoldingPrice(holdingId: string, portfolioId: string, userId: string) {
    const holding = await this.findOne(holdingId, userId);
    if (!holding) throw new Error('Holding not found');
    if (holding.portfolio_id !== portfolioId) throw new Error('Unauthorized');

    const { MarketDataService } = await import('./marketData.service');
    const latestPrice = await MarketDataService.getLatestPrice(holding.symbol);
    if (!latestPrice) throw new Error('Price data unavailable for symbol: ' + holding.symbol);

    holding.current_price = latestPrice;
    holding.market_value = Number(holding.quantity) * latestPrice;
    await holdingRepo().save(holding);

    await PortfolioService.updateStatistics(portfolioId);
    return holding;
  }

  /**
   * 批量刷新组合持仓价格
   */
  static async refreshPortfolioPrices(portfolioId: string, userId: string) {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    const { MarketDataService } = await import('./marketData.service');

    for (const holding of holdings) {
      const latestPrice = await MarketDataService.getLatestPrice(holding.symbol);
      if (latestPrice) {
        holding.current_price = latestPrice;
        holding.market_value = Number(holding.quantity) * latestPrice;
        await holdingRepo().save(holding);
      }
    }

    await PortfolioService.updateStatistics(portfolioId);
    return holdings;
  }

  static async updatePrices(holdings: { holding_id: string; current_price: number }[]) {
    for (const h of holdings) {
      const holding = await holdingRepo().findOne({ where: { holding_id: h.holding_id } });
      if (!holding) continue;
      const quantity = Number(holding.quantity) || 0;
      await holdingRepo().update(h.holding_id, {
        current_price: h.current_price,
        market_value: h.current_price * quantity,
      });
    }
  }
}
