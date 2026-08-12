/**
 * [PRME-TS-002] 用户设置
 * 文件: user.controller.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ConsentService } from '../services/consent.service';
import { DataExportService } from '../services/dataExport.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';

export const getProfile = async (req: any, res: Response) => {
  try {
    const profile = await UserService.getProfile(req.user.user_id);
    return successResponse(res, profile);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const profile = await UserService.updateProfile(req.user.user_id, req.body);
    return successResponse(res, profile, 'Profile updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const updateWechatInfo = async (req: any, res: Response) => {
  try {
    const result = await AuthService.updateWechatUser(req.user.user_id, req.body);
    return successResponse(res, result, 'WeChat info updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getPreferences = async (req: any, res: Response) => {
  try {
    const prefs = await UserService.getPreferences(req.user.user_id);
    return successResponse(res, prefs);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updatePreferences = async (req: any, res: Response) => {
  try {
    const prefs = await UserService.updatePreferences(req.user.user_id, req.body);
    return successResponse(res, prefs, 'Preferences updated');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getUsers = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const result = await UserService.getUsers(parseInt(page), parseInt(limit), { status, search });
    return paginatedResponse(res, result.users, result.total, result.page, result.limit);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteUser = async (req: any, res: Response) => {
  try {
    await UserService.deleteUser(req.params.id);
    return successResponse(res, null, 'User deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

/**
 * 首次风险提示确认
 * POST /api/v1/users/risk-acknowledgment
 */
export const riskAcknowledgment = async (req: any, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { user_id: req.user.user_id } });
    if (!user) throw new Error('User not found');

    user.first_risk_acknowledged = true;
    user.first_risk_acknowledged_at = new Date();
    await userRepo.save(user);

    return successResponse(res, {
      first_risk_acknowledged: true,
      acknowledged_at: user.first_risk_acknowledged_at,
    }, 'Risk acknowledgment confirmed');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 获取首次风险提示状态
 * GET /api/v1/users/risk-acknowledgment/status
 */
export const getRiskAcknowledgmentStatus = async (req: any, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { user_id: req.user.user_id },
      select: ['user_id', 'first_risk_acknowledged', 'first_risk_acknowledged_at'],
    });
    if (!user) throw new Error('User not found');

    return successResponse(res, {
      first_risk_acknowledged: user.first_risk_acknowledged,
      acknowledged_at: user.first_risk_acknowledged_at,
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 记录用户同意
 * POST /api/v1/users/consents
 */
export const recordConsent = async (req: any, res: Response) => {
  try {
    const { consent_type, granted_via } = req.body;
    if (!consent_type) {
      return errorResponse(res, 'consent_type is required', 400);
    }
    const result = await ConsentService.recordConsent(
      req.user.user_id,
      consent_type,
      granted_via || 'api',
      req.ip || undefined,
    );
    return successResponse(res, result, 'Consent recorded');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 撤销用户同意
 * DELETE /api/v1/users/consents/:consent_type
 */
export const revokeConsent = async (req: any, res: Response) => {
  try {
    const { consent_type } = req.params;
    const { reason } = req.body;
    const result = await ConsentService.revokeConsent(req.user.user_id, consent_type, reason);
    return successResponse(res, result, 'Consent revoked');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 获取用户同意列表
 * GET /api/v1/users/consents
 */
export const getConsents = async (req: any, res: Response) => {
  try {
    const consents = await ConsentService.getConsents(req.user.user_id);
    return successResponse(res, consents);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 请求数据导出
 * POST /api/v1/users/data-export
 */
export const requestDataExport = async (req: any, res: Response) => {
  try {
    const { format, include_tables } = req.body;
    const result = await DataExportService.requestExport(req.user.user_id, format || 'json', include_tables);
    return successResponse(res, result, 'Export request submitted');
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

/**
 * 获取导出状态
 * GET /api/v1/users/data-export/:export_id
 */
export const getExportStatus = async (req: any, res: Response) => {
  try {
    const result = await DataExportService.getExportStatus(req.user.user_id, req.params.export_id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

/**
 * 获取导出列表
 * GET /api/v1/users/data-export
 */
export const getExportList = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await DataExportService.getExportList(req.user.user_id, parseInt(page), parseInt(limit));
    return paginatedResponse(res, result.exports, result.total, result.page, result.limit);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * 下载导出文件
 * GET /api/v1/users/data-export/:export_id/download
 */
export const downloadExport = async (req: any, res: Response) => {
  try {
    const { filePath, fileName } = await DataExportService.downloadExport(req.user.user_id, req.params.export_id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
