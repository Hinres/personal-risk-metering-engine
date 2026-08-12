/**
 * [PRME-PA-001] pagination 单元测试
 * 测试范围: buildPaginationOptions, buildPaginationResult, paginate
 * 最后更新: 2026-07-08
 */

import { buildPaginationOptions, buildPaginationResult, paginate } from '../../src/utils/pagination';

const mockRepo = () => ({
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
});

describe('pagination', () => {
  describe('buildPaginationOptions', () => {
    it('should build with default page and limit when params are empty', () => {
      const opts = buildPaginationOptions({} as any);
      expect(opts.skip).toBe(0);
      expect(opts.take).toBe(10);
    });

    it('should build with default params', () => {
      const opts = buildPaginationOptions({ page: 1, limit: 10 });
      expect(opts.skip).toBe(0);
      expect(opts.take).toBe(10);
    });

    it('should build with custom page', () => {
      const opts = buildPaginationOptions({ page: 3, limit: 20 });
      expect(opts.skip).toBe(40);
      expect(opts.take).toBe(20);
    });

    it('should merge with existing options', () => {
      const opts = buildPaginationOptions({ page: 1, limit: 10 }, { where: { active: true } as any });
      expect(opts.where).toEqual({ active: true });
    });
  });

  describe('buildPaginationResult', () => {
    it('should build with defaults', () => {
      const result = buildPaginationResult([{ id: 1 }], 1, { page: 1, limit: 10 });
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('should build with default params', () => {
      const result = buildPaginationResult([{ id: 1 }], 20, {} as any);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('should detect hasNext', () => {
      const result = buildPaginationResult([{ id: 1 }, { id: 2 }], 20, { page: 1, limit: 10 });
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('should use default page when only limit provided', () => {
      const opts = buildPaginationOptions({ limit: 20 } as any);
      expect(opts.skip).toBe(0);
      expect(opts.take).toBe(20);
    });

    it('should use default limit when only page provided', () => {
      const opts = buildPaginationOptions({ page: 3 } as any);
      expect(opts.skip).toBe(20);
      expect(opts.take).toBe(10);
    });

    it('should detect both hasNext and hasPrev', () => {
      const result = buildPaginationResult([{ id: 1 }], 30, { page: 2, limit: 10 });
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(true);
    });
  });

  describe('paginate', () => {
    it('should paginate repository', async () => {
      const repo = mockRepo() as any;
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const result = await paginate(repo, { page: 1, limit: 10 }, { active: true } as any);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
