import { Request, Response } from 'express';
import { HelpContentService } from '../services/helpContent.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * 获取帮助内容列表
 * GET /api/v1/help
 * [PRME-TS-003]
 */
export const getHelpList = async (req: any, res: Response) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const result = await HelpContentService.getList(
      category,
      parseInt(page),
      parseInt(limit)
    );
    return paginatedResponse(res, result.items, result.total, result.page, result.limit);
  } catch (error: any) {
    logger.error('Help list fetch failed', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 按主题获取帮助内容
 * GET /api/v1/help/:topic
 * [PRME-TS-003]
 */
export const getHelpByTopic = async (req: any, res: Response) => {
  try {
    const content = await HelpContentService.getByTopic(req.params.topic);
    return successResponse(res, content);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

/**
 * 搜索帮助内容
 * GET /api/v1/help/search
 */
export const searchHelp = async (req: any, res: Response) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q) {
      return errorResponse(res, 'Search query (q) is required', 400);
    }
    const result = await HelpContentService.search(q, parseInt(page), parseInt(limit));
    return paginatedResponse(res, result.items, result.total, result.page, result.limit);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

// ==================== 管理后台接口（需管理员权限） ====================

/**
 * 创建帮助内容
 * POST /api/v1/help
 */
export const createHelp = async (req: any, res: Response) => {
  try {
    const content = await HelpContentService.create(req.body);
    return successResponse(res, content, 'Help content created', 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 更新帮助内容
 * PUT /api/v1/help/:id
 */
export const updateHelp = async (req: any, res: Response) => {
  try {
    const content = await HelpContentService.update(req.params.id, req.body);
    return successResponse(res, content, 'Help content updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

/**
 * 删除帮助内容
 * DELETE /api/v1/help/:id
 */
export const deleteHelp = async (req: any, res: Response) => {
  try {
    await HelpContentService.delete(req.params.id);
    return successResponse(res, null, 'Help content deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};
