/**
 * [PRME-INFRA-001] 认证与授权
 * 文件: riskAcknowledgment.middleware.ts
 * 需求描述: 认证与授权功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: any;
}

/**
 * 首次风险提示中间件
 * 拦截未确认首次风险提示的用户，返回 403 并携带提示信息
 * 允许访问的路由白名单（认证、同意、用户信息相关）
 */
const RISK_ACK_WHITELIST = [
  '/api/v1/users/risk-acknowledgment',
  '/api/v1/auth/',
  '/api/v1/users/consents',
  '/api/v1/users/profile',
  '/api/v1/users/preferences',
  '/api/v1/users/data-export',
  '/api/v1/health',
];

export const riskAcknowledgmentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // 白名单放行
  if (RISK_ACK_WHITELIST.some(path => req.path.startsWith(path))) {
    return next();
  }

  if (!req.user?.user_id) {
    return next(); // 无用户信息时放行（authMiddleware 会在后续处理）
  }

  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { user_id: req.user.user_id },
      select: ['user_id', 'first_risk_acknowledged'],
    });

    if (!user || !user.first_risk_acknowledged) {
      return errorResponse(res, '首次风险提示未确认', 403, JSON.stringify({
        code: 'RISK_ACK_REQUIRED',
        requires_action: 'risk_acknowledgment',
        message: '请在使用前阅读并确认投资风险提示',
        action_url: '/api/v1/users/risk-acknowledgment',
      }));
    }

    next();
  } catch (error: any) {
    logger.error('Risk acknowledgment check failed', { error: error.message, userId: req.user?.user_id });
    return errorResponse(res, '风险提示检查失败', 500);
  }
};

/**
 * 优化建议授权检查中间件
 * 用户必须明确同意 optimization_advice 才能使用优化建议功能
 */
export const optimizationConsentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // NEW-004: 开发/测试环境可通过环境变量跳过优化建议授权检查
  if (process.env.OPTIMIZATION_CONSENT_SKIP === 'true') {
    return next();
  }

  if (!req.user?.user_id) {
    return next();
  }

  try {
    const { ConsentService } = await import('../services/consent.service');
    const hasConsent = await ConsentService.checkConsent(req.user.user_id, 'optimization_advice');

    if (!hasConsent) {
      return errorResponse(res, '未授权优化建议功能', 403, JSON.stringify({
        code: 'CONSENT_REQUIRED',
        consent_type: 'optimization_advice',
        message: '请先在设置中授权优化建议服务',
        action_url: '/api/v1/users/consents',
      }));
    }

    next();
  } catch (error: any) {
    logger.error('Optimization consent check failed', { error: error.message });
    next(); // 降级：不阻止请求
  }
};
