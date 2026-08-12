/**
 * [PRME-INFRA-003] L1 内存缓存单元测试
 * 测试范围: memoryCache 单例实例
 * 最后更新: 2026-06-20
 */
import { memoryCache, MEMORY_CACHE_TTL, buildMemoryCacheKey } from '../../src/utils/memoryCache';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('memoryCache singleton', () => {
  beforeEach(() => {
    memoryCache.clear();
  });

  afterEach(() => {
    memoryCache.clear();
  });

  describe('set / get', () => {
    it('should set and get a value', () => {
      memoryCache.set('key1', 'value1', 10000);
      expect(memoryCache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      expect(memoryCache.get('nonexistent')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', () => {
      memoryCache.set('key3', 'value3', 10000);
      expect(memoryCache.get('key3')).toBe('value3');
      memoryCache.delete('key3');
      expect(memoryCache.get('key3')).toBeNull();
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching prefix', () => {
      memoryCache.set('prefix:a', 1, 10000);
      memoryCache.set('prefix:b', 2, 10000);
      memoryCache.set('other:c', 3, 10000);
      const count = memoryCache.deletePattern('prefix:');
      expect(count).toBe(2);
      expect(memoryCache.get('prefix:a')).toBeNull();
      expect(memoryCache.get('prefix:b')).toBeNull();
      expect(memoryCache.get('other:c')).toBe(3);
    });

    it('should return 0 for no matches', () => {
      memoryCache.set('other:d', 4, 10000);
      expect(memoryCache.deletePattern('nomatch:')).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      memoryCache.set('key4', 'value4', 10000);
      expect(memoryCache.has('key4')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(memoryCache.has('nonexistent')).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should return positive TTL for fresh entry', () => {
      memoryCache.set('key5', 'value5', 10000);
      const ttl = memoryCache.getTTL('key5');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10000);
    });

    it('should return -1 for non-existent key', () => {
      expect(memoryCache.getTTL('nonexistent')).toBe(-1);
    });
  });

  describe('stats', () => {
    it('should return correct stats', () => {
      memoryCache.set('key6', 'value6', 10000);
      const stats = memoryCache.stats();
      expect(stats.size).toBe(1);
      expect(stats.memoryEstimateBytes).toBeGreaterThan(0);
    });

    it('should return zero for empty cache', () => {
      memoryCache.clear();
      const stats = memoryCache.stats();
      expect(stats.size).toBe(0);
      expect(stats.memoryEstimateBytes).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clean expired entries and log count', () => {
      memoryCache.set('expiredA', 'value', -1); // already expired
      memoryCache.set('activeB', 'value', 10000);
      // Manually invoke private cleanup
      (memoryCache as any).cleanup();
      expect(memoryCache.get('expiredA')).toBeNull();
      expect(memoryCache.get('activeB')).toBe('value');
    });
  });

  describe('get', () => {
    it('should return null for expired entry', async () => {
      memoryCache.set('expired', 'value', 1);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(memoryCache.get('expired')).toBeNull();
    });
  });

  describe('getTTL', () => {
    it('should return -1 for expired entry', async () => {
      memoryCache.set('expired2', 'value', 1);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(memoryCache.getTTL('expired2')).toBe(-1);
    });
  });

  describe('stop', () => {
    it('should stop cleanup interval', () => {
      memoryCache.stop();
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle stop when already stopped', () => {
      memoryCache.stop();
      memoryCache.stop(); // should not throw
      expect(true).toBe(true);
    });
  });
});

describe('MEMORY_CACHE_TTL constants', () => {
  it('should have correct TTL values', () => {
    expect(MEMORY_CACHE_TTL.VaR_RESULT).toBe(300_000);
    expect(MEMORY_CACHE_TTL.PORTFOLIO_HOLDINGS).toBe(60_000);
    expect(MEMORY_CACHE_TTL.DASHBOARD_SNAPSHOT).toBe(30_000);
    expect(MEMORY_CACHE_TTL.MONITOR_SNAPSHOT).toBe(60_000);
    expect(MEMORY_CACHE_TTL.STOCK_SEARCH).toBe(300_000);
    expect(MEMORY_CACHE_TTL.MARKET_DATA).toBe(60_000);
    expect(MEMORY_CACHE_TTL.USER_PREFERENCES).toBe(600_000);
    expect(MEMORY_CACHE_TTL.REPORT_METADATA).toBe(300_000);
    expect(MEMORY_CACHE_TTL.SYSTEM_CONFIG).toBe(600_000);
  });
});

describe('buildMemoryCacheKey', () => {
  it('should build key with single part', () => {
    expect(buildMemoryCacheKey('var', 'p1')).toBe('var:p1');
  });

  it('should build key with multiple parts', () => {
    expect(buildMemoryCacheKey('var', 'p1', 0.95, 1)).toBe('var:p1:0.95:1');
  });

  it('should build key with only prefix', () => {
    expect(buildMemoryCacheKey('prefix')).toBe('prefix:');
  });
});
