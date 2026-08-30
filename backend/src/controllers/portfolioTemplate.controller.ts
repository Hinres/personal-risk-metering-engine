/**
 * [PRME-v1.3-PA-005] 模板化投资组合
 * 文件: portfolioTemplate.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { PortfolioTemplateService } from '../services/portfolioTemplate.service';
import { successResponse, errorResponse } from '../utils/response';

export const getPortfolioTemplates = async (req: any, res: Response) => {
  try {
    const riskLevel = req.query.risk_level as string | undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await PortfolioTemplateService.getTemplates(riskLevel, page, pageSize);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getPortfolioTemplateById = async (req: any, res: Response) => {
  try {
    const result = await PortfolioTemplateService.getTemplateById(req.params.id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const createPortfolioFromTemplate = async (req: any, res: Response) => {
  try {
    const userId = req.user.user_id;
    const { template_id, name, description, total_value, adjustments } = req.body;
    const result = await PortfolioTemplateService.applyTemplate(
      userId,
      template_id,
      name,
      description || null,
      Number(total_value) || 100000,
      adjustments || {}
    );
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
