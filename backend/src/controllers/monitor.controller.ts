/**
 * [PRME-RM-001] 实时风险监控
 * 文件: monitor.controller.ts
 * 需求描述: 实时风险监控功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { VaRCalculation } from '../models/VaRCalculation';
import { AlertHistory } from '../models/AlertHistory';
import { MonitorConfig } from '../models/MonitorConfig';
import { MonitorService } from '../services/monitor.service';
import { validateMonitorParams, sendValidationError } from '../utils/validators';
import { getCachedDashboard, setCachedDashboard, invalidateMonitorSnapshotCache, invalidateDashboardCache } from '../services/cache.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import logger from '../utils/logger';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const alertRepo = () => AppDataSource.getRepository(AlertHistory);
const monitorRepo = () => AppDataSource.getRepository(MonitorConfig);

export const getDashboard = async (req: any, res: Response) => {
  try {
    const userId = req.user.user_id;

    // 尝试从缓存获取仪表盘
    const cached = await getCachedDashboard(userId);
    if (cached) {
      return successResponse(res, { ...cached, cached: true }, 'Dashboard (cached)');
    }

    // 1. 用户组合列表
    const portfolios = await portfolioRepo().find({
      where: { user_id: userId, status: 'active' },
      order: { created_at: 'DESC' },
    });

    // 2. 组合风险指标聚合
    const portfolioMetrics = await Promise.all(
      portfolios.map(async (p) => {
        const holdings = await holdingRepo().find({ where: { portfolio_id: p.portfolio_id } });
        const latestVar = await varRepo().findOne({
          where: { portfolio_id: p.portfolio_id },
          order: { calculated_at: 'DESC' },
        });
        const activeAlerts = await alertRepo().count({
          where: { portfolio_id: p.portfolio_id, status: 'active' },
        });
        const monitors = await monitorRepo().count({
          where: { portfolio_id: p.portfolio_id, status: 'active' },
        });

        const totalValue = holdings.reduce((sum, h) => sum + (Number(h.market_value) || 0), 0);
        const totalCost = holdings.reduce((sum, h) => sum + (Number(h.quantity) || 0) * (Number(h.cost_price) || 0), 0);
        const unrealizedPnl = totalValue - totalCost;
        const returnRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

        return {
          portfolio_id: p.portfolio_id,
          name: p.name,
          holding_count: holdings.length,
          total_value: totalValue,
          total_cost: totalCost,
          unrealized_pnl: unrealizedPnl,
          return_rate: returnRate,
          latest_var: latestVar ? {
            var_value: latestVar.var_value,
            var_percentage: latestVar.var_percentage,
            confidence_level: latestVar.confidence_level,
            method: latestVar.calculation_type,
            date: latestVar.calculated_at,
          } : null,
          active_alerts: activeAlerts,
          active_monitors: monitors,
        };
      })
    );

    // 3. 用户级汇总
    const totalPortfolioValue = portfolioMetrics.reduce((sum, p) => sum + p.total_value, 0);
    const totalActiveAlerts = portfolioMetrics.reduce((sum, p) => sum + p.active_alerts, 0);
    const totalMonitors = portfolioMetrics.reduce((sum, p) => sum + p.active_monitors, 0);

    // 4. 最近预警
    const recentAlerts = await alertRepo().find({
      where: { user_id: userId },
      order: { triggered_at: 'DESC' },
      take: 10,
    });

    const result = {
      summary: {
        portfolio_count: portfolios.length,
        total_value: totalPortfolioValue,
        total_active_alerts: totalActiveAlerts,
        total_active_monitors: totalMonitors,
      },
      portfolios: portfolioMetrics,
      recent_alerts: recentAlerts,
    };

    // 缓存仪表盘
    await setCachedDashboard(userId, result);

    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch dashboard', 500);
  }
};

export const getMonitors = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.query;
    const monitors = await MonitorService.getMonitors(req.user.user_id, portfolio_id);
    return successResponse(res, monitors);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/monitors/:id
 * 获取单个监控规则详情
 */
export const getMonitorById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Monitor ID is required', 400);
    }

    const monitor = await MonitorService.getMonitor(id, req.user.user_id);
    if (!monitor) {
      return errorResponse(res, 'Monitor not found', 404);
    }

    // 组装小程序编辑页期望的字段，同时保留原始字段
    const notification = monitor.notification || {};
    const response = {
      ...monitor,
      monitor_name: monitor.config_name,
      monitor_id: monitor.config_id,
      threshold_value: monitor.threshold,
      comparison: monitor.operator,
      severity: monitor.rules?.severity ?? monitor.metrics?.severity ?? 'medium',
      notification_methods: Array.isArray(notification.channels) ? notification.channels : [],
    };

    return successResponse(res, response);
  } catch (error: any) {
    logger.error('Get monitor by id failed', { error: error.message, id: req.params.id });
    return errorResponse(res, 'Failed to retrieve monitor', 500);
  }
};

export const createMonitor = async (req: any, res: Response) => {
  try {
    // 参数校验精确化
    const validation = validateMonitorParams(req.body);
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }
    const monitor = await MonitorService.create(req.user.user_id, req.body);
    return successResponse(res, monitor, 'Monitor created', 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const updateMonitor = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Monitor ID is required', 400);
    }
    const monitor = await MonitorService.update(id, req.user.user_id, req.body);

    // 清除缓存
    await invalidateMonitorSnapshotCache(monitor.portfolio_id);
    await invalidateDashboardCache(req.user.user_id);

    return successResponse(res, monitor, 'Monitor updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const deleteMonitor = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Monitor ID is required', 400);
    }
    await MonitorService.delete(id, req.user.user_id);

    // 清除缓存
    await invalidateDashboardCache(req.user.user_id);

    return successResponse(res, null, 'Monitor deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};
