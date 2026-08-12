import { Request, Response } from 'express';
import { ToolService } from '../services/tool.service';
import { AuditService } from '../services/audit.service';
import { validateVaRParams, sendValidationError } from '../utils/validators';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * 独立VaR计算器（不保存到组合）
 * POST /api/v1/tools/var-calc
 * [PRME-TS-001]
 */
export const calculateToolVaR = async (req: any, res: Response) => {
  try {
    const { holdings, method, confidence_level, time_horizon, monte_carlo_iterations, distribution, random_seed } = req.body;

    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return errorResponse(res, 'holdings array is required', 400);
    }

    // 校验 VaR 参数（复用现有校验器）
    const validation = validateVaRParams({
      portfolio_id: 'tool_calculator',
      method,
      confidence_level,
      time_horizon,
    });
    if (!validation.valid) {
      return sendValidationError(res, validation);
    }

    // 校验持仓
    for (const h of holdings) {
      if (!h.symbol || h.quantity === undefined || h.quantity === null) {
        return errorResponse(res, `Each holding must have symbol and quantity`, 400);
      }
    }

    const result = await ToolService.calculateVaR(req.user.user_id, {
      method,
      confidence_level: Number(confidence_level),
      time_horizon: Number(time_horizon),
      monte_carlo_iterations: monte_carlo_iterations ? Number(monte_carlo_iterations) : undefined,
      distribution,
      random_seed: random_seed !== undefined ? Number(random_seed) : undefined,
      holdings,
    });

    await AuditService.log('CALCULATE', 'tool_var_history', result.var_id || null, {
      method, confidence_level, time_horizon, holdings_count: holdings.length,
    }, { userId: req.user.user_id, ipAddress: req.ip });

    return successResponse(res, result, 'VaR calculation completed');
  } catch (error: any) {
    logger.error('Tool VaR calculation failed', { error: error.message, userId: req.user?.user_id });
    return errorResponse(res, error.message || 'VaR calculation failed', 500);
  }
};

/**
 * 获取计算历史
 * GET /api/v1/tools/var-history
 * [PRME-TS-001]
 */
export const getToolVaRHistory = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ToolService.getHistory(
      req.user.user_id,
      parseInt(page),
      parseInt(limit)
    );
    return paginatedResponse(res, result.history, result.total, result.page, result.limit);
  } catch (error: any) {
    logger.error('Tool VaR history fetch failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 获取历史详情
 * GET /api/v1/tools/var-history/:id
 */
export const getToolVaRHistoryDetail = async (req: any, res: Response) => {
  try {
    const record = await ToolService.getHistoryById(req.user.user_id, req.params.id);
    return successResponse(res, record);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

/**
 * 保存参数预设
 * POST /api/v1/tools/var-presets
 * [PRME-TS-001]
 */
export const savePreset = async (req: any, res: Response) => {
  try {
    const { name, ...preset } = req.body;
    if (!name) {
      return errorResponse(res, 'name is required', 400);
    }
    const result = await ToolService.savePreset(req.user.user_id, name, preset);
    return successResponse(res, result, 'Preset saved');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 获取参数预设
 * GET /api/v1/tools/var-presets
 */
export const getPresets = async (req: any, res: Response) => {
  try {
    const presets = await ToolService.getPresets(req.user.user_id);
    return successResponse(res, presets);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 删除参数预设
 * DELETE /api/v1/tools/var-presets/:name
 */
export const deletePreset = async (req: any, res: Response) => {
  try {
    const result = await ToolService.deletePreset(req.user.user_id, req.params.name);
    return successResponse(res, result, 'Preset deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
