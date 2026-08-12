/**
 * [PRME-INFRA-006] 基础设施 - pagination utils 单元测试
 * 测试范围: buildPaginationOptions, buildPaginationResult, paginate
 * 最后更新: 2026-06-20
 */
import { buildPaginationOptions, buildPaginationResult, paginate, PaginationParams } from '../../src/utils/pagination';

const mockRepo = (data: any[], total: number) => ({
  findAndCount: jest.fn().mockResolvedValue([data, total]),
});

describe('buildPaginationOptions', () => {
  it('should calculate skip correctly', () => {
    const result = buildPaginationOptions({ page: 3, limit: 10 });
    expect(result.skip).toBe(20);
    expect(result.take).toBe(10);
  });

  it('should use defaults for missing params', () => {
    const result = buildPaginationOptions({} as PaginationParams);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(10);
  });

  it('should merge with existing options', () => {
    const result = buildPaginationOptions({ page: 2, limit: 5 }, { order: { id: 'ASC' } as any });
    expect(result.skip).toBe(5);
    expect(result.take).toBe(5);
    expect(result.order).toEqual({ id: 'ASC' });
  });

  it('should handle page 1 correctly', () => {
    const result = buildPaginationOptions({ page: 1, limit: 20 });
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });
});

describe('buildPaginationResult', () => {
  it('should build correct pagination result', () => {
    const result = buildPaginationResult([{ id: 1 }], 100, { page: 2, limit: 10 });
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 100, totalPages: 10, hasNext: true, hasPrev: true });
  });

  it('should set hasNext=false on last page', () => {
    const result = buildPaginationResult([], 10, { page: 1, limit: 10 });
    expect(result.meta.hasNext).toBe(false);
    expect(result.meta.hasPrev).toBe(false);
  });

  it('should set hasPrev=false on first page', () => {
    const result = buildPaginationResult([], 100, { page: 1, limit: 10 });
    expect(result.meta.hasPrev).toBe(false);
    expect(result.meta.hasNext).toBe(true);
  });

  it('should set hasNext=false when page > totalPages', () => {
    const result = buildPaginationResult([], 10, { page: 2, limit: 10 });
    expect(result.meta.hasNext).toBe(false);
    expect(result.meta.hasPrev).toBe(true);
  });

  it('should handle zero total', () => {
    const result = buildPaginationResult([], 0, { page: 1, limit: 10 });
    expect(result.meta.totalPages).toBe(0);
  });

  it('should round up totalPages', () => {
    const result = buildPaginationResult([], 11, { page: 1, limit: 5 });
    expect(result.meta.totalPages).toBe(3);
  });
});

describe('paginate', () => {
  it('should call findAndCount with correct options', async () => {
    const repo = mockRepo([{ id: 1 }], 10) as any;
    const result = await paginate(repo, { page: 2, limit: 5 }, { active: true } as any);
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5, take: 5, where: { active: true }, order: { created_at: 'DESC' },
    }));
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.meta.total).toBe(10);
  });

  it('should handle empty where clause', async () => {
    const repo = mockRepo([], 0) as any;
    const result = await paginate(repo, { page: 1, limit: 10 });
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0, take: 10, order: { created_at: 'DESC' },
    }));
    expect(result.meta.totalPages).toBe(0);
  });
});
