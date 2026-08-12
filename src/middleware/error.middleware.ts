/**
 * [PRME-INFRA-006] 基础设施
 * 文件: error.middleware.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';
  // 生产环境不记录 stack trace，防止泄露服务器目录结构
  logger.error('Error occurred', {
    error: err.message,
    ...(isDev && { stack: err.stack }),
    path: req.path,
    method: req.method,
  });
  
  if (err.name === 'ValidationError') {
    return errorResponse(res, 'Validation Error', 400, err.message);
  }
  if (err.name === 'UnauthorizedError') {
    return errorResponse(res, 'Unauthorized', 401);
  }
  if (err.name === 'NotFoundError') {
    return errorResponse(res, 'Not Found', 404);
  }
  
  return errorResponse(res, 'Internal Server Error', 500, process.env.NODE_ENV === 'development' ? err.message : undefined);
};
