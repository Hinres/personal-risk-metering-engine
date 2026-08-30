/**
 * [PRME-INFRA-006] P1-6 数据库类型辅助工具
 * 提供跨数据库（SQLite / PostgreSQL）的列类型装饰器
 */
import { Column, ColumnOptions } from 'typeorm';

export type DbType = 'sqlite' | 'postgres';

let _dbType: DbType | null = null;

/**
 * 获取当前数据库类型（优先从环境变量，可运行时覆盖）
 */
export function getDbType(): DbType {
  if (_dbType) return _dbType;
  const env = process.env.DB_TYPE || 'sqlite';
  if (env !== 'sqlite' && env !== 'postgres') {
    console.warn(`[dbTypes] Unknown DB_TYPE "${env}", defaulting to sqlite`);
    _dbType = 'sqlite';
  } else {
    _dbType = env as DbType;
  }
  return _dbType;
}

/**
 * 运行时覆盖数据库类型（用于测试或动态切换）
 */
export function setDbType(type: DbType): void {
  _dbType = type;
  console.log(`[dbTypes] Database type set to: ${type}`);
}

/**
 * JSON 列装饰器
 * - PostgreSQL → jsonb（支持 GIN 索引、JSON 路径查询）
 * - SQLite → simple-json（TEXT 存储，自动序列化）
 */
export function JsonColumn(options?: Omit<ColumnOptions, 'type'>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    const type = getDbType() === 'postgres' ? 'jsonb' : 'simple-json';
    Column({ ...options, type })(target, propertyKey);
  };
}

/**
 * 日期时间列装饰器
 * - PostgreSQL → timestamp
 * - SQLite → datetime
 */
export function DateTimeColumn(options?: Omit<ColumnOptions, 'type'>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    const type = getDbType() === 'postgres' ? 'timestamp' : 'datetime';
    Column({ ...options, type })(target, propertyKey);
  };
}

/**
 * 获取原始类型字符串（用于非装饰器场景）
 */
export function getJsonType(): 'jsonb' | 'simple-json' {
  return getDbType() === 'postgres' ? 'jsonb' : 'simple-json';
}

export function getDateTimeType(): 'timestamp' | 'datetime' {
  return getDbType() === 'postgres' ? 'timestamp' : 'datetime';
}

/**
 * 生成 PostgreSQL 特有的 JSONB 索引 DDL
 * 仅在 PostgreSQL 下执行，SQLite 下忽略
 */
export function getJsonbIndexSql(table: string, column: string, indexName: string): string {
  return getDbType() === 'postgres'
    ? `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" USING GIN ("${column}");`
    : '';
}
