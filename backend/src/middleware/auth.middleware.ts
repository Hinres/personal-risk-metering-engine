/**
 * [PRME-INFRA-001] 认证与授权
 * 文件: auth.middleware.ts
 * 需求描述: 认证与授权功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response';
import { AuthService } from '../services/auth.service';
import { JWT_CONFIG } from '../config/jwt';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Unauthorized - No token provided', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const isBlacklisted = await AuthService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return errorResponse(res, 'Token has been revoked', 401);
    }

    const decoded = jwt.verify(token, JWT_CONFIG.secret) as any;
    req.user = decoded;
    next();
  } catch (error: any) {
    logger.error('JWT verify error', { error: error.message, path: req.path });
    return errorResponse(res, 'Unauthorized - Invalid token', 401);
  }
};

/**
 * 管理员权限中间件
 * 必须在 authMiddleware 之后使用
 */
export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(res, 'Forbidden - Admin access required', 403);
  }
  next();
};
