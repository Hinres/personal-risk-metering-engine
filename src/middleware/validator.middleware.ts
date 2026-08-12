/**
 * [PRME-INFRA-006] 基础设施
 * 文件: validator.middleware.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { errorResponse } from '../utils/response';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: any) {
      return errorResponse(res, 'Validation failed', 400, error.errors);
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error: any) {
      return errorResponse(res, 'Query validation failed', 400, error.errors);
    }
  };
};
