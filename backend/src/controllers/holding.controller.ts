/**
 * [PRME-RM-003] 持仓风险管理
 * 文件: holding.controller.ts
 * 需求描述: 持仓风险管理功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Holding } from '../models/Holding';
import { Portfolio } from '../models/Portfolio';
import { validateHoldingParams, sendValidationError } from '../utils/validators';
import { invalidateHoldingsCache, invalidateVaRCache, invalidateDashboardCache } from '../services/cache.service';
import { PortfolioService } from '../services/portfolio.service';
import { HoldingService } from '../services/holding.service';
import { AuditService } from '../services/audit.service';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

const holdingRepo = () => AppDataSource.getRepository(Holding);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

export const getHoldings = async (req: any, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId }, order: { created_at: 'DESC' } });
    // F-01：统一序列化（含顶层 purchase_date），列表与详情口径一致
    return successResponse(res, holdings.map(h => HoldingService.serializeHolding(h)));
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch holdings', 500);
  }
};

/**
 * GET /api/v1/holdings/:id
 * 获取单个持仓详情（权限校验在 Service 层统一处理）
 */
export const getHoldingById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Holding ID is required', 400);
    }

    const holding = await HoldingService.findOne(id, req.user.user_id);
    if (!holding) {
      return errorResponse(res, 'Holding not found', 404);
    }

    // F-01：统一序列化（列优先、metadata 兜底；无日期返回 null，收敛原空串行为）
    const response = HoldingService.serializeHolding(holding);
    return successResponse(res, response);
  } catch (error: any) {
    logger.error('Get holding by id failed', { error: error.message, id: req.params.id });
    return errorResponse(res, 'Failed to retrieve holding', 500);
  }
};

export const addHolding = async (req: any, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const { symbol, name, security_type, exchange, quantity, cost_price, sector, industry } = req.body;

    // Validate portfolio ownership
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }

    // 参数校验精确化
    const validation = validateHoldingParams({ symbol, name, security_type, exchange, quantity, cost_price, sector, industry });
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    // Check for duplicate holding (same symbol in same portfolio)
    const existingHolding = await holdingRepo().findOne({
      where: { portfolio_id: portfolioId, symbol: symbol.trim() }
    });
    if (existingHolding) {
      return errorResponse(res, `Holding with symbol '${symbol}' already exists in this portfolio`, 409);
    }

    // 获取现有持仓，构建预测持仓列表（包含新持仓）
    const existingHoldings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    const newMarketValue = Number(quantity) * Number(cost_price);
    const projectedHoldings = [
      ...existingHoldings.map(h => ({
        symbol: h.symbol,
        quantity: h.quantity,
        cost_price: h.cost_price,
        market_value: Number(h.market_value?.toString() || h.quantity * h.cost_price),
        sector: h.sector,
        industry: h.industry,
      })),
      {
        symbol: symbol.trim(),
        quantity: Number(quantity),
        cost_price: Number(cost_price),
        market_value: newMarketValue,
        sector,
        industry,
      }
    ];

    // 检查持仓限制（预测检查：添加新持仓后的状态）
    const limitCheck = await PortfolioService.checkHoldingLimits(portfolioId, req.user.user_id, projectedHoldings);
    if (limitCheck.breaches.length > 0) {
      const blockBreach = limitCheck.breaches.find(b => b.action_on_breach === 'block');
      if (blockBreach) {
        return errorResponse(res, `持仓限制阻止: ${blockBreach.limit_type} 超限 (预测权重 ${(blockBreach.current_weight * 100).toFixed(2)}%, 最大权重 ${(blockBreach.max_weight * 100).toFixed(2)}%)`, 403);
      }
      const alertBreach = limitCheck.breaches.find(b => b.action_on_breach === 'alert');
      if (alertBreach) {
        logger.warn('Holding limit alert on add', { portfolioId, alertBreach, isProjected: true });
      }
    }

    // 自动获取当前价格（解决 HLD-005 / DEF-CONT-001：添加持仓时 price 为 null）
    let currentPrice: number | null = null;
    try {
      const { MarketDataService } = await import('../services/marketData.service');
      currentPrice = await MarketDataService.getLatestPrice(symbol.trim());
    } catch (e: any) {
      logger.warn('Failed to fetch latest price when adding holding', { symbol, error: e.message });
    }
    const marketValue = currentPrice ? Number(quantity) * currentPrice : null;

    // 归一化前端 metadata 字段（purchase_date / remark / market）到 metadata JSON
    const metadata = HoldingService.normalizeMetadataInput(req.body);
    // F-01：purchase_date 同步写入独立列（单一事实源 = 列，metadata 双写兼容既有编辑链路）
    const purchaseDateCol = HoldingService.normalizePurchaseDateColumn(req.body.purchase_date);

    const holding = holdingRepo().create({
      portfolio_id: portfolioId,
      symbol: symbol.trim(),
      name,
      security_type,
      exchange: exchange || null,
      quantity: Number(quantity),
      cost_price: Number(cost_price),
      current_price: currentPrice,
      market_value: marketValue,
      sector,
      industry,
      purchase_date: purchaseDateCol === undefined ? null : purchaseDateCol,
      metadata,
    });
    await holdingRepo().save(holding);

    // Update portfolio statistics (migrated from PostgreSQL trigger)
    await PortfolioService.updateStatistics(portfolioId);

    // 清除缓存
    await invalidateHoldingsCache(portfolioId);
    await invalidateVaRCache(portfolioId);
    await invalidateDashboardCache(req.user.user_id);

    // Audit log (migrated from PostgreSQL trigger)
    await AuditService.logCreate('holdings', holding.holding_id, { symbol, quantity: Number(quantity) }, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, HoldingService.serializeHolding(holding), 'Holding added', 201);
  } catch (error: any) {
    return errorResponse(res, 'Failed to add holding', 500);
  }
};

export const updateHolding = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const holding = await HoldingService.findOne(id, req.user.user_id);
    if (!holding) {
      return errorResponse(res, 'Holding not found', 404);
    }

    const oldData = { ...holding };
    const updates = req.body;

    // 参数校验精确化（部分更新）
    if (updates.quantity !== undefined || updates.cost_price !== undefined || updates.symbol !== undefined) {
      const validation = validateHoldingParams({
        symbol: updates.symbol !== undefined ? updates.symbol : holding.symbol,
        name: updates.name !== undefined ? updates.name : holding.name,
        security_type: updates.security_type !== undefined ? updates.security_type : holding.security_type,
        quantity: updates.quantity !== undefined ? updates.quantity : holding.quantity,
        cost_price: updates.cost_price !== undefined ? updates.cost_price : holding.cost_price,
        sector: updates.sector !== undefined ? updates.sector : holding.sector,
        industry: updates.industry !== undefined ? updates.industry : holding.industry,
      });
      if (!validation.valid) {
        return sendValidationError(res, validation);
      }
    }

    // 构建预测持仓：排除当前持仓，加入更新后的持仓
    const portfolioId = holding.portfolio_id;
    const existingHoldings = await holdingRepo().find({ where: { portfolio_id: portfolioId } });
    const updatedQty = updates.quantity !== undefined ? Number(updates.quantity) : holding.quantity;
    const updatedCost = updates.cost_price !== undefined ? Number(updates.cost_price) : holding.cost_price;
    const updatedMarketValue = updatedQty * updatedCost;
    const projectedHoldings = [
      ...existingHoldings.filter(h => h.holding_id !== holding.holding_id).map(h => ({
        symbol: h.symbol,
        quantity: h.quantity,
        cost_price: h.cost_price,
        market_value: Number(h.market_value?.toString() || h.quantity * h.cost_price),
        sector: h.sector,
        industry: h.industry,
      })),
      {
        symbol: updates.symbol !== undefined ? updates.symbol.trim() : holding.symbol,
        quantity: updatedQty,
        cost_price: updatedCost,
        market_value: updatedMarketValue,
        sector: updates.sector !== undefined ? updates.sector : holding.sector,
        industry: updates.industry !== undefined ? updates.industry : holding.industry,
      }
    ];

    const limitCheck = await PortfolioService.checkHoldingLimits(portfolioId, req.user.user_id, projectedHoldings);
    if (limitCheck.breaches.length > 0) {
      const blockBreach = limitCheck.breaches.find(b => b.action_on_breach === 'block');
      if (blockBreach) {
        return errorResponse(res, `持仓限制阻止: ${blockBreach.limit_type} 超限 (预测权重 ${(blockBreach.current_weight * 100).toFixed(2)}%, 最大权重 ${(blockBreach.max_weight * 100).toFixed(2)}%)`, 403);
      }
      const alertBreach = limitCheck.breaches.find(b => b.action_on_breach === 'alert');
      if (alertBreach) {
        logger.warn('Holding limit alert on update', { portfolioId, alertBreach, holdingId: holding.holding_id, isProjected: true });
      }
    }

    // 字段归一化与持久化统一在 Service 层处理
    await HoldingService.update(id, req.user.user_id, updates, holding);

    // Update portfolio statistics (migrated from PostgreSQL trigger)
    await PortfolioService.updateStatistics(holding.portfolio_id);

    // 清除缓存
    await invalidateHoldingsCache(holding.portfolio_id);
    await invalidateVaRCache(holding.portfolio_id);
    await invalidateDashboardCache(req.user.user_id);

    // Audit log (migrated from PostgreSQL trigger)
    await AuditService.logUpdate('holdings', id, oldData, holding, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, HoldingService.serializeHolding(holding), 'Holding updated');
  } catch (error: any) {
    return errorResponse(res, 'Failed to update holding', 500);
  }
};

export const deleteHolding = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const holding = await HoldingService.findOne(id, req.user.user_id);
    if (!holding) {
      return errorResponse(res, 'Holding not found', 404);
    }

    const oldData = { ...holding };
    const portfolioId = holding.portfolio_id;
    await HoldingService.delete(id, req.user.user_id, holding);

    // Update portfolio statistics (migrated from PostgreSQL trigger)
    await PortfolioService.updateStatistics(portfolioId);

    // 清除缓存
    await invalidateHoldingsCache(portfolioId);
    await invalidateVaRCache(portfolioId);
    await invalidateDashboardCache(req.user.user_id);

    // Audit log (migrated from PostgreSQL trigger)
    await AuditService.logDelete('holdings', id, oldData, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, null, 'Holding deleted');
  } catch (error: any) {
    return errorResponse(res, 'Failed to delete holding', 500);
  }
};

/**
 * 刷新单个持仓价格
 * POST /api/v1/portfolios/:portfolioId/holdings/:holdingId/refresh-price
 */
export const refreshHoldingPrice = async (req: any, res: Response) => {
  try {
    const { portfolioId, holdingId } = req.params;
    const holding = await HoldingService.refreshHoldingPrice(holdingId, portfolioId, req.user.user_id);
    return successResponse(res, holding, 'Holding price refreshed');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 批量刷新组合持仓价格
 * POST /api/v1/portfolios/:portfolioId/refresh-prices
 */
export const refreshPortfolioPrices = async (req: any, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const holdings = await HoldingService.refreshPortfolioPrices(portfolioId, req.user.user_id);
    return successResponse(res, holdings, 'Portfolio prices refreshed');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
