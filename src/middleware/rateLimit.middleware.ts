/**
 * [PRME-INFRA-001] 认证与授权 — 内存令牌桶限流
 * 文件: rateLimit.middleware.ts
 * 需求描述: 替代 Redis 限流，使用内存令牌桶算法
 * 关联: arc v1.2 架构设计 §3.3.1
 * 最后更新: 2026-06-17
 */
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';

// 内存令牌桶实现（简单滑动窗口）
interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

class MemoryRateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每 5 分钟清理过期条目
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  increment(key: string, windowMs: number): { totalHits: number; resetTime: number } {
    const now = Date.now();
    const resetAt = now + windowMs;
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // 窗口已过期，重置
      this.store.set(key, { count: 1, resetAt });
      return { totalHits: 1, resetTime: resetAt };
    }

    entry.count += 1;
    return { totalHits: entry.count, resetTime: entry.resetAt };
  }

  decrement(key: string): void {
    const entry = this.store.get(key);
    if (entry && entry.count > 0) {
      entry.count -= 1;
    }
  }

  resetKey(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info('MemoryRateLimit cleaned', { cleaned, remaining: this.store.size });
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 追踪所有创建的 MemoryRateLimitStore 实例，用于优雅关闭
const stores: MemoryRateLimitStore[] = [];

// 创建基于内存的 rate-limit store（每个 limiter 独立实例）
function createMemoryStore(windowMs: number) {
  const store = new MemoryRateLimitStore();
  stores.push(store);
  return {
    increment: async (key: string) => {
      const result = store.increment(key, windowMs);
      return {
        totalHits: result.totalHits,
        resetTime: new Date(result.resetTime),
      };
    },
    decrement: async (key: string) => {
      store.decrement(key);
    },
    resetKey: async (key: string) => {
      store.resetKey(key);
    },
  };
}

// 兼容旧代码：保留一个默认的 memoryStore（不再被 limiter 使用，仅保留导出兼容性）
const memoryStore = new MemoryRateLimitStore();
stores.push(memoryStore);

export { MemoryRateLimitStore };

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMemoryStore(15 * 60 * 1000) as any,
  validate: { ip: false, keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => {
    // 基于用户ID限流，未登录则基于 IP
    return req.user?.user_id || req.ip || 'unknown';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') ? 50 : 5,
  message: {
    success: false,
    message: 'Too many authentication attempts',
  },
  store: createMemoryStore(15 * 60 * 1000) as any,
  validate: { ip: false, keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => req.ip || 'unknown',
});

export const calcLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: 'Calculation rate limit exceeded',
  },
  store: createMemoryStore(60 * 1000) as any,
  validate: { ip: false, keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => {
    return req.user?.user_id || req.ip || 'unknown';
  },
});

// 优雅关闭时清理所有限流存储
export function stopRateLimitStore(): void {
  for (const store of stores) {
    store.stop();
  }
  stores.length = 0;
}
