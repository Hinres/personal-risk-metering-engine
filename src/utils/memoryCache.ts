/**
 * [PRME-INFRA-003] 性能与缓存 — L1 应用内存缓存
 * 文件: memoryCache.ts
 * 需求描述: 替代 Redis 热点数据缓存，进程级内存缓存
 * 关联: arc v1.2 架构设计 §3.2.1
 * 最后更新: 2026-06-14
 */
import logger from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private static instance: MemoryCache;
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // 每 60 秒清理过期项
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttlMs TTL 毫秒数
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
    logger.debug('MemoryCache set', { key: key.substring(0, 30), ttlMs });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值或 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    logger.debug('MemoryCache hit', { key: key.substring(0, 30) });
    return entry.value as T;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 按模式删除缓存（前缀匹配）
   */
  deletePattern(pattern: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.info('MemoryCache pattern deleted', { pattern, count });
    }
    return count;
  }

  /**
   * 检查是否存在（不过期检查）
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * 获取剩余 TTL（毫秒）
   */
  getTTL(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -1;
  }

  /**
   * 获取缓存统计
   */
  stats(): { size: number; memoryEstimateBytes: number } {
    let memoryEstimate = 0;
    for (const [key, entry] of this.store) {
      memoryEstimate += key.length * 2 + JSON.stringify(entry.value).length * 2 + 32;
    }
    return { size: this.store.size, memoryEstimateBytes: memoryEstimate };
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info('MemoryCache cleaned', { cleaned, remaining: this.store.size });
    }
  }

  /**
   * 清空全部缓存
   */
  clear(): void {
    this.store.clear();
    logger.info('MemoryCache cleared');
  }

  /**
   * 停止清理定时器（用于优雅关闭）
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const memoryCache = MemoryCache.getInstance();

// 缓存 TTL 配置（毫秒）
export const MEMORY_CACHE_TTL = {
  VaR_RESULT: 300_000,        // 5分钟
  PORTFOLIO_HOLDINGS: 60_000,   // 1分钟
  DASHBOARD_SNAPSHOT: 30_000,   // 30秒
  MONITOR_SNAPSHOT: 60_000,     // 1分钟
  STOCK_SEARCH: 300_000,        // 5分钟
  MARKET_DATA: 60_000,          // 1分钟
  USER_PREFERENCES: 600_000,    // 10分钟
  REPORT_METADATA: 300_000,     // 5分钟
  SYSTEM_CONFIG: 600_000,       // 10分钟
};

// 缓存 Key 生成器（兼容原 Redis 格式）
export function buildMemoryCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}
