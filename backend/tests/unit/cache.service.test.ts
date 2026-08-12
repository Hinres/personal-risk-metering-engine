/**
 * [PRME-INFRA-003] cache.service 单元测试
 * 文件: cache.service.test.ts
 * 测试范围: key生成器, getCache/setCache/deleteCache, VaR缓存, holdings缓存, dashboard缓存, 清理任务
 * 最后更新: 2026-06-25
 */
import * as cacheService from '../../src/services/cache.service';
import { AppDataSource } from '../../src/config/database';
import { memoryCache } from '../../src/utils/memoryCache';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/memoryCache', () => ({
  memoryCache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
    getTTL: jest.fn(),
    stats: jest.fn().mockReturnValue({ size: 0, memoryEstimateBytes: 0 }),
  },
  MEMORY_CACHE_TTL: {
    PORTFOLIO_HOLDINGS: 60000,
    DASHBOARD_SNAPSHOT: 30000,
  },
  buildMemoryCacheKey: jest.fn((k: string) => `mem:${k}`),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  count: jest.fn().mockResolvedValue(0),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    }),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('cache.service', () => {
  let compRepo: ReturnType<typeof mockRepo>;
  let snapRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    compRepo = mockRepo();
    snapRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'ComputationCache' || name?.includes('Computation')) return compRepo;
      if (name === 'MarketSnapshotCache' || name?.includes('Snapshot')) return snapRepo;
      return mockRepo();
    });
    // Reset createQueryBuilder mock to default
    (AppDataSource.createQueryBuilder as jest.Mock).mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    });
  });

  // ── key 生成器 ──
  describe('key builders', () => {
    it('CACHE-001: buildVaRKey 应生成正确格式', () => {
      const key = cacheService.buildVaRKey('p1', 'mc', 0.95, 1);
      expect(key).toBe('var:p1:mc:0.9500:1');
    });

    it('CACHE-002: buildHoldingsKey 应包含 portfolioId', () => {
      expect(cacheService.buildHoldingsKey('p1')).toBe('holdings:p1');
    });

    it('CACHE-001a: buildVaRKey 极端值方法应包含 estimation_method', () => {
      const key = cacheService.buildVaRKey('p1', 'extreme_value', 0.95, 1, 'mle');
      expect(key).toBe('var:p1:extreme_value:0.9500:1:mle');
    });

    it('CACHE-001b: buildVaRKey 非极端值方法应忽略 estimation_method', () => {
      const key = cacheService.buildVaRKey('p1', 'historical', 0.95, 1, 'mle');
      expect(key).toBe('var:p1:historical:0.9500:1');
    });

    it('CACHE-003: buildStockSearchKey 应小写并 trim', () => {
      expect(cacheService.buildStockSearchKey('  ABC  ')).toBe('stock:search:abc');
    });
  });

  // ── getCache ──
  describe('getCache', () => {
    it('CACHE-004: L1 命中时应直接返回', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue({ value: 42 });
      const result = await cacheService.getCache('var:p1:mc:0.95:1');
      expect(result).toEqual({ value: 42 });
      expect(compRepo.findOne).not.toHaveBeenCalled();
    });

    it('CACHE-005: L1 未命中 L2 命中时应回填', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      const now = Math.floor(Date.now() / 1000) + 100;
      compRepo.findOne.mockResolvedValue({
        cache_key: 'var:p1:mc:0.95:1',
        result_json: '{"data":1}',
        expires_at: now,
        hit_count: 0,
      });
      compRepo.save.mockResolvedValue({});

      const result = await cacheService.getCache('var:p1:mc:0.95:1');
      expect(result).toEqual({ data: 1 });
      expect(memoryCache.set).toHaveBeenCalled();
      expect(compRepo.save).toHaveBeenCalled();
    });

    it('CACHE-006: L2 过期时应删除并返回 null', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      compRepo.findOne.mockResolvedValue({
        cache_key: 'var:p1:mc:0.95:1',
        expires_at: Math.floor(Date.now() / 1000) - 10,
      });

      const result = await cacheService.getCache('var:p1:mc:0.95:1');
      expect(result).toBeNull();
      expect(compRepo.delete).toHaveBeenCalled();
    });

    it('CACHE-007: 非 var 前缀时不应查 SQLite', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      const result = await cacheService.getCache('dashboard:u1');
      expect(result).toBeNull();
      expect(compRepo.findOne).not.toHaveBeenCalled();
    });

    it('CACHE-007a: L2 SQLite 查询失败时应返回 null', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      compRepo.findOne.mockRejectedValue(new Error('DB error'));

      const result = await cacheService.getCache('var:p1:mc:0.95:1');
      expect(result).toBeNull();
    });
  });

  // ── setCache ──
  describe('setCache', () => {
    it('CACHE-008: 应写入 L1 和 L2（var 前缀）', async () => {
      const result = await cacheService.setCache('var:p1:mc:0.95:1', { data: 1 }, 300);
      expect(result).toBe(true);
      expect(memoryCache.set).toHaveBeenCalled();
      expect(compRepo.create).toHaveBeenCalled();
      expect(compRepo.save).toHaveBeenCalled();
    });

    it('CACHE-009: 非 var 前缀只写 L1', async () => {
      const result = await cacheService.setCache('dashboard:u1', { data: 1 }, 300);
      expect(result).toBe(true);
      expect(memoryCache.set).toHaveBeenCalled();
      expect(compRepo.create).not.toHaveBeenCalled();
    });

    it('CACHE-009a: L2 写入失败时应返回 false', async () => {
      compRepo.create.mockImplementation(() => { throw new Error('DB error'); });
      const result = await cacheService.setCache('var:p1:mc:0.95:1', { data: 1 }, 300);
      expect(result).toBe(false);
    });
  });

  // ── deleteCache ──
  describe('deleteCache', () => {
    it('CACHE-010: 应删除 L1 和 L2', async () => {
      const result = await cacheService.deleteCache('var:p1:mc:0.95:1');
      expect(result).toBe(true);
      expect(memoryCache.delete).toHaveBeenCalled();
      expect(compRepo.delete).toHaveBeenCalled();
    });

    it('CACHE-010a: L2 删除失败时应返回 false', async () => {
      compRepo.delete.mockRejectedValue(new Error('DB error'));
      const result = await cacheService.deleteCache('var:p1:mc:0.95:1');
      expect(result).toBe(false);
    });
  });

  // ── deleteCachePattern ──
  describe('deleteCachePattern', () => {
    it('CACHE-011: 应删除匹配前缀的缓存', async () => {
      (memoryCache.deletePattern as jest.Mock).mockReturnValue(3);
      compRepo.find.mockResolvedValue([
        { cache_key: 'var:p1:mc:0.95:1' },
        { cache_key: 'var:p1:hs:0.99:1' },
      ]);

      const result = await cacheService.deleteCachePattern('var:p1:');
      expect(result).toBe(5); // 3 memory + 2 sqlite
    });

    it('CACHE-011a: pattern 非 var 前缀时不应查 SQLite', async () => {
      (memoryCache.deletePattern as jest.Mock).mockReturnValue(2);
      const result = await cacheService.deleteCachePattern('dashboard:');
      expect(result).toBe(2);
      expect(compRepo.find).not.toHaveBeenCalled();
    });

    it('CACHE-011b: SQLite 删除失败时应只返回 memory 计数', async () => {
      (memoryCache.deletePattern as jest.Mock).mockReturnValue(3);
      compRepo.find.mockRejectedValue(new Error('DB error'));
      const result = await cacheService.deleteCachePattern('var:p1:');
      expect(result).toBe(3);
    });
  });

  // ── getCacheTTL ──
  describe('getCacheTTL', () => {
    it('CACHE-012: L1 有 TTL 时应返回', async () => {
      (memoryCache.getTTL as jest.Mock).mockReturnValue(5000);
      const result = await cacheService.getCacheTTL('var:p1:mc:0.95:1');
      expect(result).toBe(5);
    });

    it('CACHE-012a: L2 未过期时应返回剩余秒数', async () => {
      (memoryCache.getTTL as jest.Mock).mockReturnValue(-1);
      compRepo.findOne.mockResolvedValue({
        expires_at: Math.floor(Date.now() / 1000) + 120,
      });
      const result = await cacheService.getCacheTTL('var:p1:mc:0.95:1');
      expect(result).toBeGreaterThan(0);
    });

    it('CACHE-013: L2 过期时应返回 -1', async () => {
      (memoryCache.getTTL as jest.Mock).mockReturnValue(-1);
      compRepo.findOne.mockResolvedValue({
        expires_at: Math.floor(Date.now() / 1000) - 10,
      });
      const result = await cacheService.getCacheTTL('var:p1:mc:0.95:1');
      expect(result).toBe(-1);
    });

    it('CACHE-013a: L2 查询失败时应返回 -1', async () => {
      (memoryCache.getTTL as jest.Mock).mockReturnValue(-1);
      compRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await cacheService.getCacheTTL('var:p1:mc:0.95:1');
      expect(result).toBe(-1);
    });

    it('CACHE-013b: 非 var 前缀时应返回 -1', async () => {
      (memoryCache.getTTL as jest.Mock).mockReturnValue(-1);
      const result = await cacheService.getCacheTTL('dashboard:u1');
      expect(result).toBe(-1);
    });
  });

  // ── VaR 缓存便捷方法 ──
  describe('VaR cache helpers', () => {
    it('CACHE-014: getCachedVaR / setCachedVaR / invalidateVaRCache', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue({ var: 100 });
      const cached = await cacheService.getCachedVaR('p1', 'mc', 0.95, 1);
      expect(cached).toEqual({ var: 100 });

      await cacheService.setCachedVaR('p1', 'mc', 0.95, 1, { var: 200 });
      expect(memoryCache.set).toHaveBeenCalled();
    });
  });

  // ── holdings / dashboard / monitor 等 L1 缓存 ──
  describe('L1 only caches', () => {
    it('CACHE-015: holdings cache', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue([{ symbol: 'A' }]);
      const result = await cacheService.getCachedHoldings('p1');
      expect(result).toEqual([{ symbol: 'A' }]);
      await cacheService.setCachedHoldings('p1', [{ symbol: 'B' }]);
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-016: dashboard cache', async () => {
      await cacheService.setCachedDashboard('u1', { total: 100 });
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-017: monitor snapshot cache', async () => {
      await cacheService.setCachedMonitorSnapshot('p1', { alerts: 0 });
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-018: stock search cache', async () => {
      await cacheService.setCachedStockSearch('abc', [{ symbol: '000001' }]);
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-019: market data cache', async () => {
      await cacheService.setCachedMarketData('000001', { price: 12 });
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-020: user preferences cache', async () => {
      await cacheService.setCachedUserPreferences('u1', { theme: 'dark' });
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-021: report metadata cache', async () => {
      await cacheService.setCachedReportMetadata('r1', { name: '月报' });
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-022: system config cache', async () => {
      await cacheService.setCachedSystemConfig('theme', 'dark');
      expect(memoryCache.set).toHaveBeenCalled();
      (memoryCache.delete as jest.Mock).mockReturnValue(true);
      await cacheService.invalidateSystemConfigCache('theme');
      expect(memoryCache.delete).toHaveBeenCalled();
    });
  });

  // ── warm cache ──
  describe('warmCache', () => {
    it('CACHE-024: 命中时直接返回缓存', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue([{ symbol: 'A' }]);
      const fetchFn = jest.fn();
      const result = await cacheService.warmCachePortfolio('p1', fetchFn);
      expect(result).toEqual([{ symbol: 'A' }]);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('CACHE-025: 未命中时 fetch 并缓存', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      const fetchFn = jest.fn().mockResolvedValue([{ symbol: 'B' }]);
      const result = await cacheService.warmCachePortfolio('p1', fetchFn);
      expect(result).toEqual([{ symbol: 'B' }]);
      expect(fetchFn).toHaveBeenCalled();
      expect(memoryCache.set).toHaveBeenCalled();
    });

    it('CACHE-025a: dashboard 命中时直接返回', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue({ total: 100 });
      const fetchFn = jest.fn();
      const result = await cacheService.warmCacheDashboard('u1', fetchFn);
      expect(result).toEqual({ total: 100 });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('CACHE-025b: dashboard 未命中时 fetch 并缓存', async () => {
      (memoryCache.get as jest.Mock).mockReturnValue(null);
      const fetchFn = jest.fn().mockResolvedValue({ total: 200 });
      const result = await cacheService.warmCacheDashboard('u1', fetchFn);
      expect(result).toEqual({ total: 200 });
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  // ── cache stats ──
  describe('getCacheStats', () => {
    it('CACHE-023: 应返回统计信息', async () => {
      const result = await cacheService.getCacheStats();
      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('memorySize');
      expect(result).toHaveProperty('sqliteSize');
    });

    it('CACHE-023a: SQLite 统计失败时应返回 sqliteSize=0', async () => {
      compRepo.count.mockRejectedValue(new Error('DB error'));
      const result = await cacheService.getCacheStats();
      expect(result.sqliteSize).toBe(0);
    });
  });

  // ── 清理任务 ──
  describe('cleanup', () => {
    it('CACHE-026: cleanupExpiredCache 应删除过期记录', async () => {
      const result = await cacheService.cleanupExpiredCache();
      expect(result).toEqual({ deleted: 5 });
    });

    it('CACHE-026a: cleanupExpiredCache 失败时应返回 deleted=0', async () => {
      const queryBuilder = AppDataSource.createQueryBuilder as jest.Mock;
      queryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const result = await cacheService.cleanupExpiredCache();
      expect(result).toEqual({ deleted: 0 });
    });

    it('CACHE-027: cleanupExpiredMarketSnapshots 应删除过期快照', async () => {
      const result = await cacheService.cleanupExpiredMarketSnapshots();
      expect(result).toEqual({ deleted: 5 });
    });

    it('CACHE-027a: cleanupExpiredMarketSnapshots 失败时应返回 deleted=0', async () => {
      const queryBuilder = AppDataSource.createQueryBuilder as jest.Mock;
      queryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const result = await cacheService.cleanupExpiredMarketSnapshots();
      expect(result).toEqual({ deleted: 0 });
    });
  });
});
