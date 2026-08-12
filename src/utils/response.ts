/**
 * [PRME-INFRA-006] 基础设施
 * 文件: response.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const successResponse = <T>(res: Response, data: T, message = 'Success', statusCode = 200) => {
  const response: ApiResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(response);
};

export const errorResponse = (res: Response, message: string, statusCode = 400, error?: string) => {
  const response: ApiResponse = { success: false, message, error };
  return res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(res: Response, data: T[], total: number, page: number, limit: number) => {
  const totalPages = Math.ceil(total / limit);
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: { page, limit, total, totalPages }
  };
  return res.status(200).json(response);
};
