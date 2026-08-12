/**
 * [PRME-INFRA-006] 基础设施
 * 文件: pagination.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { FindManyOptions, FindOptionsWhere, Repository, ObjectLiteral } from 'typeorm';

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * 分页结果接口
 */
export interface PaginationResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 构建分页查询
 */
export function buildPaginationOptions<T extends ObjectLiteral>(
  params: PaginationParams,
  options?: FindManyOptions<T>
): FindManyOptions<T> {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  return {
    ...options,
    skip,
    take: limit,
  };
}

/**
 * 构建分页结果
 */
export function buildPaginationResult<T extends ObjectLiteral>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginationResult<T> {
  const { page = 1, limit = 10 } = params;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * 通用分页查询方法
 */
export async function paginate<T extends ObjectLiteral>(
  repository: Repository<T>,
  params: PaginationParams,
  where?: FindOptionsWhere<T>
): Promise<PaginationResult<T>> {
  const options = buildPaginationOptions<T>(params, {
    where,
    order: { created_at: 'DESC' } as any,
  });

  const [data, total] = await repository.findAndCount(options);
  return buildPaginationResult(data, total, params);
}
