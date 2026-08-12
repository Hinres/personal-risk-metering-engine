/**
 * [PRME-INFRA-003] 性能与缓存 — SQLite + L1 内存缓存
 * 文件: cache.service.ts
 * 需求描述: 替代 Redis 缓存，使用 L1 内存缓存 + L2 SQLite 缓存表
 * 关联: arc v1.2 架构设计 §3.2
 * 最后更新: 2026-06-14
 */
import { AppDataSource } from '../config/database';
import { ComputationCache } from '../models/ComputationCache';
import { MarketSnapshotCache } from '../models/MarketSnapshotCache';
import { PortfolioSummaryCache } from '../models/PortfolioSummaryCache';
import { memoryCache, MEMORY_CACHE_TTL, buildMemoryCacheKey } from '../utils/memoryCache';
import logger from '../utils/logger';
import crypto from 'crypto';

// ==================== 缓存 TTL 配置（秒，SQLite 层） ====================
export const CACHE_TTL = {
  VaR_RESULT: 300,        // 5分钟
  PORTFOLIO_HOLDINGS: 60,   // 1分钟
  DASHBOARD_SNAPSHOT: 30,   // 30秒
  MONITOR_SNAPSHOT: 60,     // 1分钟
  STOCK_SEARCH: 300,        // 5分钟
  MARKET_DATA: 60,          // 1分钟
  USER_PREFERENCES: 600,    // 10分钟
  REPORT_METADATA: 300,     // 5分钟
  SYSTEM_CONFIG: 600,       // 10分钟
};

// ==================== 缓存 Key 生成器（兼容原 Redis 格式） ====================
export function buildVaRKey(portfolioId: string, method: string, confidence: number, horizon: number, estimationMethod?: string): string {
  const estSuffix = estimationMethod && method === 'extreme_value' ? `:${estimationMethod}` : '';
  return `var:${portfolioId}:${method}:${confidence.toFixed(4)}:${horizon}${estSuffix}`;
}

export function buildHoldingsKey(portfolioId: string): string {
  return `holdings:${portfolioId}`;
}

export function buildDashboardKey(userId: string): string {
  return `dashboard:${userId}`;
}

export function buildMonitorSnapshotKey(portfolioId: string): string {
  return `monitor:snapshot:${portfolioId}`;
}

export function buildStockSearchKey(keyword: string): string {
  return `stock:search:${keyword.trim().toLowerCase()}`;
}

export function buildMarketDataKey(symbol: string): string {
  return `market:data:${symbol}`;
}

export function buildUserPreferencesKey(userId: string): string {
  return `user:prefs:${userId}`;
}

export function buildReportMetadataKey(reportId: string): string {
  return `report:meta:${reportId}`;
}

export function buildSystemConfigKey(key: string): string {
  return `sys:config:${key}`;
}

// ==================== 通用缓存操作（L1 内存 + L2 SQLite） ====================

/**
 * 获取缓存（先查 L1 内存，再查 L2 SQLite）
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // 1. 先查 L1 内存缓存
  const memoryValue = memoryCache.get<T>(key);
  if (memoryValue !== null) {
    logger.debug('L1 Memory cache hit', { key: key.substring(0, 30) });
    return memoryValue;
  }

  // 2. 再查 L2 SQLite 缓存（仅对 computation_cache）
  try {
    if (key.startsWith('var:')) {
      const repo = AppDataSource.getRepository(ComputationCache);
      const cached = await repo.findOne({ where: { cache_key: key } });
      if (cached && cached.expires_at > Math.floor(Date.now() / 1000)) {
        // 回填 L1
        const ttl = (cached.expires_at - Math.floor(Date.now() / 1000)) * 1000;
        memoryCache.set(key, JSON.parse(cached.result_json), Math.max(ttl, 1000));
        // 更新命中次数
        cached.hit_count += 1;
        await repo.save(cached);
        logger.debug('L2 SQLite cache hit', { key: key.substring(0, 30), hit_count: cached.hit_count });
        return JSON.parse(cached.result_json) as T;
      }
      if (cached) {
        // 已过期，删除
        await repo.delete({ cache_key: key });
      }
    }
  } catch (err) {
    logger.warn('L2 SQLite cache read failed', { key: key.substring(0, 30), error: (err as Error).message });
  }

  return null;
}

/**
 * 设置缓存（同时写入 L1 内存和 L2 SQLite）
 */
export async function setCache(key: string, data: any, ttlSeconds: number): Promise<boolean> {
  try {
    // 1. 写入 L1 内存缓存
    memoryCache.set(key, data, ttlSeconds * 1000);

    // 2. 写入 L2 SQLite（仅对 computation_cache 类型的缓存）
    if (key.startsWith('var:')) {
      const repo = AppDataSource.getRepository(ComputationCache);
      const parts = key.split(':');
      const now = Math.floor(Date.now() / 1000);
      const cache = repo.create({
        cache_key: key,
        result_json: JSON.stringify(data),
        computation_type: 'var',
        param_hash: crypto.createHash('md5').update(key).digest('hex'),
        computed_at: now,
        expires_at: now + ttlSeconds,
        hit_count: 0,
      });
      await repo.save(cache);
      logger.debug('L2 SQLite cache set', { key: key.substring(0, 30), ttl: ttlSeconds });
    }

    return true;
  } catch (err) {
    logger.warn('Cache set failed', { key: key.substring(0, 30), error: (err as Error).message });
    return false;
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<boolean> {
  memoryCache.delete(key);
  try {
    if (key.startsWith('var:')) {
      await AppDataSource.getRepository(ComputationCache).delete({ cache_key: key });
    }
    return true;
  } catch (err) {
    logger.warn('Cache delete failed', { key: key.substring(0, 30), error: (err as Error).message });
    return false;
  }
}

/**
 * 按模式删除缓存
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const memoryCount = memoryCache.deletePattern(pattern);
  let sqliteCount = 0;
  try {
    if (pattern.startsWith('var:')) {
      const repo = AppDataSource.getRepository(ComputationCache);
      const items = await repo.find();
      for (const item of items) {
        if (item.cache_key.startsWith(pattern)) {
          await repo.delete({ cache_key: item.cache_key });
          sqliteCount++;
        }
      }
    }
  } catch (err) {
    logger.warn('Cache pattern delete failed', { pattern, error: (err as Error).message });
  }
  return memoryCount + sqliteCount;
}

/**
 * 获取缓存 TTL（秒）
 */
export async function getCacheTTL(key: string): Promise<number> {
  const memoryTTL = memoryCache.getTTL(key);
  if (memoryTTL > 0) return Math.floor(memoryTTL / 1000);

  try {
    if (key.startsWith('var:')) {
      const cached = await AppDataSource.getRepository(ComputationCache).findOne({ where: { cache_key: key } });
      if (cached) {
        const remaining = cached.expires_at - Math.floor(Date.now() / 1000);
        return remaining > 0 ? remaining : -1;
      }
    }
  } catch (err) {
    logger.warn('Cache TTL check failed', { key: key.substring(0, 30), error: (err as Error).message });
  }
  return -1;
}

// ==================== VaR 缓存 ====================
export async function getCachedVaR(portfolioId: string, method: string, confidence: number, horizon: number, estimationMethod?: string): Promise<any | null> {
  const key = buildVaRKey(portfolioId, method, confidence, horizon, estimationMethod);
  return getCache(key);
}

export async function setCachedVaR(portfolioId: string, method: string, confidence: number, horizon: number, data: any, estimationMethod?: string): Promise<boolean> {
  const key = buildVaRKey(portfolioId, method, confidence, horizon, estimationMethod);
  return setCache(key, data, CACHE_TTL.VaR_RESULT);
}

export async function invalidateVaRCache(portfolioId: string): Promise<number> {
  return deleteCachePattern(`var:${portfolioId}:`);
}

// ==================== 组合持仓缓存（仅 L1 内存） ====================
export async function getCachedHoldings(portfolioId: string): Promise<any[] | null> {
  const key = buildHoldingsKey(portfolioId);
  return memoryCache.get<any[]>(key);
}

export async function setCachedHoldings(portfolioId: string, holdings: any[]): Promise<boolean> {
  const key = buildHoldingsKey(portfolioId);
  memoryCache.set(key, holdings, MEMORY_CACHE_TTL.PORTFOLIO_HOLDINGS);
  return true;
}

export async function invalidateHoldingsCache(portfolioId: string): Promise<boolean> {
  return memoryCache.delete(buildHoldingsKey(portfolioId));
}

// ==================== 仪表盘快照缓存（仅 L1 内存） ====================
export async function getCachedDashboard(userId: string): Promise<any | null> {
  return memoryCache.get(buildDashboardKey(userId));
}

export async function setCachedDashboard(userId: string, data: any): Promise<boolean> {
  memoryCache.set(buildDashboardKey(userId), data, MEMORY_CACHE_TTL.DASHBOARD_SNAPSHOT);
  return true;
}

export async function invalidateDashboardCache(userId: string): Promise<boolean> {
  return memoryCache.delete(buildDashboardKey(userId));
}

// ==================== 监控快照缓存（仅 L1 内存） ====================
export async function getCachedMonitorSnapshot(portfolioId: string): Promise<any | null> {
  return memoryCache.get(buildMonitorSnapshotKey(portfolioId));
}

export async function setCachedMonitorSnapshot(portfolioId: string, data: any): Promise<boolean> {
  memoryCache.set(buildMonitorSnapshotKey(portfolioId), data, MEMORY_CACHE_TTL.MONITOR_SNAPSHOT);
  return true;
}

export async function invalidateMonitorSnapshotCache(portfolioId: string): Promise<boolean> {
  return memoryCache.delete(buildMonitorSnapshotKey(portfolioId));
}

// ==================== 股票搜索缓存（仅 L1 内存） ====================
export async function getCachedStockSearch(keyword: string): Promise<any[] | null> {
  return memoryCache.get<any[]>(buildStockSearchKey(keyword));
}

export async function setCachedStockSearch(keyword: string, data: any[]): Promise<boolean> {
  memoryCache.set(buildStockSearchKey(keyword), data, MEMORY_CACHE_TTL.STOCK_SEARCH);
  return true;
}

// ==================== 市场数据缓存（仅 L1 内存） ====================
export async function getCachedMarketData(symbol: string): Promise<any | null> {
  return memoryCache.get(buildMarketDataKey(symbol));
}

export async function setCachedMarketData(symbol: string, data: any): Promise<boolean> {
  memoryCache.set(buildMarketDataKey(symbol), data, MEMORY_CACHE_TTL.MARKET_DATA);
  return true;
}

// ==================== 用户偏好缓存（仅 L1 内存） ====================
export async function getCachedUserPreferences(userId: string): Promise<any | null> {
  return memoryCache.get(buildUserPreferencesKey(userId));
}

export async function setCachedUserPreferences(userId: string, data: any): Promise<boolean> {
  memoryCache.set(buildUserPreferencesKey(userId), data, MEMORY_CACHE_TTL.USER_PREFERENCES);
  return true;
}

// ==================== 报告元数据缓存（仅 L1 内存） ====================
export async function getCachedReportMetadata(reportId: string): Promise<any | null> {
  return memoryCache.get(buildReportMetadataKey(reportId));
}

export async function setCachedReportMetadata(reportId: string, data: any): Promise<boolean> {
  memoryCache.set(buildReportMetadataKey(reportId), data, MEMORY_CACHE_TTL.REPORT_METADATA);
  return true;
}

// ==================== 系统配置缓存（仅 L1 内存） ====================
export async function getCachedSystemConfig(key: string): Promise<any | null> {
  return memoryCache.get(buildSystemConfigKey(key));
}

export async function setCachedSystemConfig(key: string, data: any): Promise<boolean> {
  memoryCache.set(buildSystemConfigKey(key), data, MEMORY_CACHE_TTL.SYSTEM_CONFIG);
  return true;
}

export async function invalidateSystemConfigCache(key: string): Promise<boolean> {
  return memoryCache.delete(buildSystemConfigKey(key));
}

// ==================== 缓存统计 ====================
export async function getCacheStats(): Promise<{ connected: boolean; memorySize: number; sqliteSize: number; memoryEstimateBytes: number }> {
  const memoryStats = memoryCache.stats();
  let sqliteSize = 0;
  try {
    sqliteSize = await AppDataSource.getRepository(ComputationCache).count();
  } catch (err) {
    logger.warn('SQLite cache stats failed', { error: (err as Error).message });
  }
  return {
    connected: true,
    memorySize: memoryStats.size,
    sqliteSize,
    memoryEstimateBytes: memoryStats.memoryEstimateBytes,
  };
}

// ==================== 缓存预热 ====================
export async function warmCachePortfolio(portfolioId: string, fetchFn: () => Promise<any>): Promise<any> {
  const cached = await getCachedHoldings(portfolioId);
  if (cached) return cached;
  const data = await fetchFn();
  await setCachedHoldings(portfolioId, data);
  return data;
}

export async function warmCacheDashboard(userId: string, fetchFn: () => Promise<any>): Promise<any> {
  const cached = await getCachedDashboard(userId);
  if (cached) return cached;
  const data = await fetchFn();
  await setCachedDashboard(userId, data);
  return data;
}

// ==================== 定时清理任务（替代 Redis 过期） ====================
/**
 * 清理 SQLite 缓存表中已过期条目
 * 建议每 5 分钟执行一次
 */
export async function cleanupExpiredCache(): Promise<{ deleted: number }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await AppDataSource
      .createQueryBuilder()
      .delete()
      .from(ComputationCache)
      .where('expires_at < :now', { now })
      .execute();
    const deleted = result.affected || 0;
    if (deleted > 0) {
      logger.info('SQLite cache cleanup', { deleted, type: 'computation_cache' });
    }
    return { deleted };
  } catch (err) {
    logger.warn('SQLite cache cleanup failed', { error: (err as Error).message });
    return { deleted: 0 };
  }
}

/**
 * 清理 SQLite 市场快照缓存中已过期条目
 */
export async function cleanupExpiredMarketSnapshots(): Promise<{ deleted: number }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await AppDataSource
      .createQueryBuilder()
      .delete()
      .from(MarketSnapshotCache)
      .where('expires_at < :now', { now })
      .execute();
    const deleted = result.affected || 0;
    if (deleted > 0) {
      logger.info('SQLite cache cleanup', { deleted, type: 'market_snapshot_cache' });
    }
    return { deleted };
  } catch (err) {
    logger.warn('SQLite snapshot cleanup failed', { error: (err as Error).message });
    return { deleted: 0 };
  }
}
