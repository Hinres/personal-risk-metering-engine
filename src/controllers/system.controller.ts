/**
 * [PRME-INFRA-005] 系统配置
 * 文件: system.controller.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { SystemService } from '../services/system.service';
import { successResponse, errorResponse } from '../utils/response';

export const getConfig = async (req: any, res: Response) => {
  try {
    const { key } = req.params;
    const value = await SystemService.getConfig(key);
    return successResponse(res, { key, value });
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const setConfig = async (req: any, res: Response) => {
  try {
    const { key } = req.params;
    const { value, type, description } = req.body;
    const config = await SystemService.setConfig(key, value, type, description);
    return successResponse(res, config, 'Config updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getAllConfigs = async (req: any, res: Response) => {
  try {
    const { type } = req.query;
    const configs = await SystemService.getAllConfigs(type);
    return successResponse(res, configs);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteConfig = async (req: any, res: Response) => {
  try {
    await SystemService.deleteConfig(req.params.key);
    return successResponse(res, null, 'Config deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
