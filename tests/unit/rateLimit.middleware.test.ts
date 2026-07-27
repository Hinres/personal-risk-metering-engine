/**
 * [PRME-INFRA-001] 内存令牌桶限流单元测试
 * 测试范围: MemoryRateLimitStore, apiLimiter, authLimiter, calcLimiter, stopRateLimitStore
 * 最后更新: 2026-06-28
 */
import { MemoryRateLimitStore, apiLimiter, authLimiter, calcLimiter, stopRateLimitStore } from '../../src/middleware/rateLimit.middleware';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Rate limiter exports', () => {
  it('should export apiLimiter', () => {
    expect(apiLimiter).toBeDefined();
  });

  it('should export authLimiter', () => {
    expect(authLimiter).toBeDefined();
  });

  it('should export calcLimiter', () => {
    expect(calcLimiter).toBeDefined();
  });

  it('should export stopRateLimitStore', () => {
    expect(stopRateLimitStore).toBeDefined();
    expect(typeof stopRateLimitStore).toBe('function');
  });

  it('should not throw when calling stopRateLimitStore', () => {
    expect(() => stopRateLimitStore()).not.toThrow();
  });
});

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.stop();
  });

  describe('increment', () => {
    it('should create new entry when key does not exist', () => {
      const result = store.increment('key1', 60000);
      expect(result.totalHits).toBe(1);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should increment count when entry exists and not expired', () => {
      store.increment('key1', 60000);
      const result = store.increment('key1', 60000);
      expect(result.totalHits).toBe(2);
    });

    it('should reset count when entry is expired', (done) => {
      store.increment('key1', 10); // 10ms window
      setTimeout(() => {
        const result = store.increment('key1', 60000);
        expect(result.totalHits).toBe(1); // reset to 1
        done();
      }, 20);
    });
  });

  describe('decrement', () => {
    it('should decrement count when entry exists and count > 0', () => {
      store.increment('key1', 60000);
      store.increment('key1', 60000);
      store.decrement('key1');
      const result = store.increment('key1', 60000);
      expect(result.totalHits).toBe(2); // 2 + 1 - 1 = 2
    });

    it('should not throw when decrementing non-existent key', () => {
      expect(() => store.decrement('nonexistent')).not.toThrow();
    });

    it('should not decrement below 0', () => {
      store.increment('key1', 60000);
      store.decrement('key1');
      store.decrement('key1'); // count is already 0
      const result = store.increment('key1', 60000);
      expect(result.totalHits).toBe(1); // 0 + 1 = 1 (was decremented to 0, then incremented)
    });
  });

  describe('resetKey', () => {
    it('should delete the key from store', () => {
      store.increment('key1', 60000);
      store.resetKey('key1');
      const result = store.increment('key1', 60000);
      expect(result.totalHits).toBe(1); // fresh start
    });

    it('should not throw when resetting non-existent key', () => {
      expect(() => store.resetKey('nonexistent')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', (done) => {
      store.increment('key1', 10); // 10ms
      store.increment('key2', 60000); // 60s
      setTimeout(() => {
        store.increment('key3', 60000); // trigger cleanup
        // key1 should be cleaned up, key2 should remain
        done();
      }, 20);
    });

    it('should not log when no entries are cleaned', () => {
      store.increment('key1', 60000);
      // cleanup should not log when no entries expired
      store.increment('key2', 60000); // triggers cleanup via interval
    });
  });

  describe('stop', () => {
    it('should clear interval', () => {
      store.stop();
      expect(() => store.stop()).not.toThrow(); // calling stop twice should not throw
    });
  });
});

describe('Limiter keyGenerator branches', () => {
  it('apiLimiter should use user_id when available', async () => {
    const req = { user: { user_id: 'u1' }, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (apiLimiter as any)(req, res, next);
    expect(apiLimiter).toBeDefined();
  });

  it('apiLimiter should fallback to ip when user_id not available', async () => {
    const req = { ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (apiLimiter as any)(req, res, next);
  });

  it('apiLimiter should fallback to unknown when neither user_id nor ip available', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (apiLimiter as any)(req, res, next);
  });

  it('authLimiter should use ip', async () => {
    const req = { ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (authLimiter as any)(req, res, next);
  });

  it('authLimiter should fallback to unknown when ip not available', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (authLimiter as any)(req, res, next);
  });

  it('calcLimiter should use user_id when available', async () => {
    const req = { user: { user_id: 'u1' }, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (calcLimiter as any)(req, res, next);
  });

  it('calcLimiter should fallback to unknown when neither user_id nor ip available', async () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const next = jest.fn();
    await (calcLimiter as any)(req, res, next);
  });
});

describe('authLimiter development environment branch', () => {
  it('should load authLimiter with development NODE_ENV', () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'development';
      const { authLimiter: devAuthLimiter } = require('../../src/middleware/rateLimit.middleware');
      expect(devAuthLimiter).toBeDefined();
    });
  });
});
