/**
 * [PRME-PA-001] 组合结构分析
 * 文件: portfolio.controller.ts
 * 需求描述: 组合结构分析功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { AuditService } from '../services/audit.service';
import { PortfolioService } from '../services/portfolio.service';
import { escapeHtml } from '../utils/sanitize';
import { validatePortfolioParams, validatePageParams, sendValidationError } from '../utils/validators';
import { getCachedDashboard, setCachedDashboard, invalidateDashboardCache, getCachedHoldings, setCachedHoldings, invalidateHoldingsCache, invalidateVaRCache } from '../services/cache.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export const getPortfolios = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageValidation = validatePageParams(page, limit);
    if (!pageValidation.valid) {
      return sendValidationError(res, pageValidation);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [portfolios, total] = await portfolioRepo().findAndCount({
      where: { user_id: req.user.user_id },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { created_at: 'DESC' },
      relations: ['holdings']
    });

    // 为每个组合计算统计数据并缓存持仓
    const portfoliosWithStats = await Promise.all(portfolios.map(async (p) => {
      const holdings = p.holdings || [];
      const totalValue = holdings.reduce((sum: number, h: any) => {
        const mv = parseFloat(h.market_value) || 0;
        return sum + mv;
      }, 0);
      const totalCost = holdings.reduce((sum: number, h: any) => {
        const qty = parseFloat(h.quantity) || 0;
        const cost = parseFloat(h.cost_price) || 0;
        return sum + (qty * cost);
      }, 0);
      const returnRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

      // 缓存持仓
      await setCachedHoldings(p.portfolio_id, holdings);

      return {
        ...p,
        id: p.portfolio_id,
        name: escapeHtml(p.name),
        description: escapeHtml(p.description) || undefined,
        total_value: totalValue.toFixed(2),
        totalValue: totalValue.toFixed(2),
        return_rate: returnRate.toFixed(2),
        returnRate: returnRate.toFixed(2),
        holding_count: holdings.length,
        holdingCount: holdings.length
      };
    }));

    return paginatedResponse(res, portfoliosWithStats, total, pageNum, limitNum);
  } catch (error: any) {
    console.error('getPortfolios error:', error);
    return errorResponse(res, 'Failed to fetch portfolios', 500);
  }
};

export const getPortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Portfolio ID is required', 400);
    }

    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: id, user_id: req.user.user_id },
      relations: ['holdings']
    });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }

    const holdings = portfolio.holdings || [];
    const totalValue = holdings.reduce((sum: number, h: any) => {
      const mv = parseFloat(h.market_value) || 0;
      return sum + mv;
    }, 0);
    const totalCost = holdings.reduce((sum: number, h: any) => {
      const qty = parseFloat(h.quantity) || 0;
      const cost = parseFloat(h.cost_price) || 0;
      return sum + (qty * cost);
    }, 0);
    const returnRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    // 缓存持仓
    await setCachedHoldings(id, holdings);

    const portfolioWithStats = {
      ...portfolio,
      id: portfolio.portfolio_id,
      name: escapeHtml(portfolio.name),
      description: escapeHtml(portfolio.description) || undefined,
      total_value: totalValue.toFixed(2),
      totalValue: totalValue.toFixed(2),
      return_rate: returnRate.toFixed(2),
      returnRate: returnRate.toFixed(2),
      holding_count: holdings.length,
      holdingCount: holdings.length,
      holdings
    };

    return successResponse(res, portfolioWithStats);
  } catch (error: any) {
    console.error('getPortfolio error:', error);
    return errorResponse(res, 'Failed to fetch portfolio', 500);
  }
};

export const createPortfolio = async (req: any, res: Response) => {
  try {
    const { name, description, type, settings } = req.body;

    // 参数校验精确化
    const validation = validatePortfolioParams({ name, description, type });
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    const portfolio = portfolioRepo().create({
      user_id: req.user.user_id,
      name: escapeHtml(name) || name,
      description: escapeHtml(description) || description || undefined,
      type,
      settings
    });
    await portfolioRepo().save(portfolio);

    // 创建后清除仪表盘缓存
    await invalidateDashboardCache(req.user.user_id);

    await AuditService.logCreate('portfolios', portfolio.portfolio_id, { name, type }, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, portfolio, 'Portfolio created', 201);
  } catch (error: any) {
    return errorResponse(res, 'Failed to create portfolio', 500);
  }
};

export const updatePortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Portfolio ID is required', 400);
    }
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const oldData = { ...portfolio };
    const updateData = { ...req.body };
    if (updateData.name) updateData.name = escapeHtml(updateData.name);
    if (updateData.description) updateData.description = escapeHtml(updateData.description);
    Object.assign(portfolio, updateData);
    await portfolioRepo().save(portfolio);

    // 更新后清除相关缓存
    await invalidateDashboardCache(req.user.user_id);
    await invalidateHoldingsCache(id);
    await invalidateVaRCache(id);

    await AuditService.logUpdate('portfolios', id, oldData, portfolio, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, portfolio, 'Portfolio updated');
  } catch (error: any) {
    return errorResponse(res, 'Failed to update portfolio', 500);
  }
};

export const deletePortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Portfolio ID is required', 400);
    }
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const oldData = { ...portfolio };
    portfolio.status = 'deleted';
    portfolio.deleted_at = new Date();
    await portfolioRepo().save(portfolio);

    // 删除后清除相关缓存
    await invalidateDashboardCache(req.user.user_id);
    await invalidateHoldingsCache(id);
    await invalidateVaRCache(id);

    await AuditService.logDelete('portfolios', id, oldData, {
      userId: req.user.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return successResponse(res, null, 'Portfolio deleted');
  } catch (error: any) {
    return errorResponse(res, 'Failed to delete portfolio', 500);
  }
};

// ==================== 组合风险分析（设计文档路径对齐）====================
export const getPortfolioRisk = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.getRiskReturnAnalysis(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// ==================== 组合优化建议（设计文档路径对齐）====================
export const getPortfolioSuggestions = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    // 先获取组合结构分析，再返回优化建议
    const structure = await PortfolioService.getStructureAnalysis(id, req.user.user_id);
    const risk = await PortfolioService.getRiskReturnAnalysis(id, req.user.user_id);

    // 生成优化建议
    const suggestions: any[] = [];
    if (structure.concentration.top1_holding > 0.3) {
      suggestions.push({
        type: 'diversification',
        priority: 'high',
        title: '持仓集中度偏高',
        description: `最大单一持仓占比 ${(structure.concentration.top1_holding * 100).toFixed(1)}%，建议分散投资以降低集中度风险。`,
        action: '考虑增加其他行业或资产的配置',
      });
    }
    if (risk.sharpe_ratio && risk.sharpe_ratio < 0.5) {
      suggestions.push({
        type: 'risk_return',
        priority: 'medium',
        title: '风险收益比偏低',
        description: `夏普比率 ${risk.sharpe_ratio}，建议审视组合配置。`,
        action: '考虑调整高风险低收益持仓',
      });
    }
    if (risk.max_drawdown && risk.max_drawdown > 0.15) {
      suggestions.push({
        type: 'drawdown',
        priority: 'high',
        title: '最大回撤较大',
        description: `最大回撤 ${(risk.max_drawdown * 100).toFixed(1)}%，建议设置止损或调整仓位。`,
        action: '考虑降低高风险资产权重',
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'general',
        priority: 'low',
        title: '组合状态良好',
        description: '当前组合配置合理，建议定期审视。',
        action: '继续保持并关注市场变化',
      });
    }

    return successResponse(res, { portfolio_id: id, suggestions });
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// ==================== 组合结构分析 ====================
export const getPortfolioStructure = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.getStructureAnalysis(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// ==================== 风险收益分析 ====================
export const getPortfolioAnalysis = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.getRiskReturnAnalysis(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// ==================== 持仓限制 ====================
export const getHoldingLimits = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.getHoldingLimits(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const createHoldingLimit = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.createHoldingLimit(id, req.user.user_id, req.body);
    return successResponse(res, result, 'Holding limit created', 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const updateHoldingLimit = async (req: any, res: Response) => {
  try {
    const { limitId } = req.params;
    const result = await PortfolioService.updateHoldingLimit(limitId, req.user.user_id, req.body);
    return successResponse(res, result, 'Holding limit updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const deleteHoldingLimit = async (req: any, res: Response) => {
  try {
    const { limitId } = req.params;
    await PortfolioService.deleteHoldingLimit(limitId, req.user.user_id);
    return successResponse(res, null, 'Holding limit deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const checkHoldingLimits = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const result = await PortfolioService.checkHoldingLimits(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// ==================== Brinson 归因分析 (T-14) ====================
export const getPortfolioAttribution = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { AttributionService } = await import('../services/attribution.service');
    const result = await AttributionService.performBrinsonAttribution(id, req.user.user_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// SIT-PORT-007 兼容路由：独立相关性矩阵接口
export const getCorrelationMatrix = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const analysis = await PortfolioService.getStructureAnalysis(id, req.user.user_id);
    return successResponse(res, {
      portfolio_id: id,
      correlation_matrix: analysis.correlation_matrix,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

// SIT-PORT-008 兼容路由：历史对比接口（基础实现）
export const getPortfolioHistory = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { period = '3m' } = req.query;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) throw new Error('Portfolio not found');

    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    const currentValue = holdings.reduce((sum, h) => sum + (parseFloat(h.market_value?.toString() || '0')), 0);
    const currentCost = holdings.reduce((sum, h) => {
      const qty = parseFloat(h.quantity?.toString() || '0');
      const cost = parseFloat(h.cost_price?.toString() || '0');
      return sum + (qty * cost);
    }, 0);

    // 基础历史对比：返回当前数据 + 提示其他周期需数据积累
    return successResponse(res, {
      portfolio_id: id,
      period,
      current: {
        total_value: currentValue,
        total_cost: currentCost,
        total_return: currentCost > 0 ? (currentValue - currentCost) / currentCost : 0,
        holding_count: holdings.length,
        updated_at: portfolio.updated_at,
      },
      historical: null, // 需数据积累后补充
      note: 'Historical comparison requires accumulated data. Only current snapshot available in this version.',
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
