/**
 * [PRME-TS-002] 登录安全控制器
 * 文件: loginSecurity.controller.ts
 * 需求描述: 等保二级-身份鉴别控制点优化：登录历史查询、活跃设备管理
 * 最后更新: 2026-07-07
 */
import { Request, Response } from 'express';
import { LoginSecurityService } from '../services/loginSecurity.service';
import { successResponse, errorResponse } from '../utils/response';

/**
 * GET /api/v1/auth/login-history
 * 获取当前用户登录历史
 */
export const getLoginHistory = async (req: any, res: Response) => {
  try {
    const { page, limit, days } = req.query;
    const result = await LoginSecurityService.getLoginHistory(req.user.user_id, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      days: days ? parseInt(days) : undefined,
    });
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /api/v1/auth/active-devices
 * 获取当前用户活跃设备列表
 */
export const getActiveDevices = async (req: any, res: Response) => {
  try {
    const devices = await LoginSecurityService.getActiveDevices(req.user.user_id);
    return successResponse(res, devices);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
