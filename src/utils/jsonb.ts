/**
 * [PRME-INFRA-006] 基础设施
 * 文件: jsonb.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Raw } from 'typeorm';

/**
 * JSONB 查询工具函数
 */

/**
 * 检查 JSONB 字段是否包含指定键值对
 * @param field 字段名
 * @param key JSON键
 * @param value 值
 */
export function jsonbContains(field: string, key: string, value: any) {
  return Raw((alias) => `${alias} @> :value`, {
    value: JSON.stringify({ [key]: value }),
  });
}

/**
 * 检查 JSONB 字段是否包含指定路径的值
 * @param field 字段名
 * @param path JSON路径 (如: 'preferences.language')
 * @param value 值
 */
export function jsonbPathEquals(field: string, path: string, value: any) {
  const parts = path.split('.');
  const pathExpr = parts.map((p) => `'${p}'`).join('->');
  return Raw((alias) => `${alias}${pathExpr} = :value`, { value });
}

/**
 * 检查 JSONB 数组是否包含指定元素
 * @param field 字段名
 * @param element 数组元素
 */
export function jsonbArrayContains(field: string, element: any) {
  return Raw((alias) => `${alias} @> :element`, {
    element: JSON.stringify([element]),
  });
}

/**
 * 构建 JSONB 合并更新对象
 * @param existing 现有值
 * @param updates 更新值
 */
export function jsonbMerge(existing: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  return { ...existing, ...updates };
}

/**
 * 从 JSONB 字段中提取值
 * @param data JSONB数据
 * @param path 路径
 * @param defaultValue 默认值
 */
export function jsonbGet<T = any>(data: Record<string, any> | null, path: string, defaultValue?: T): T | undefined {
  if (!data) return defaultValue;
  
  const parts = path.split('.');
  let current: any = data;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[part];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * 检查 JSONB 字段是否存在指定键
 * @param field 字段名
 * @param key 键名
 */
export function jsonbHasKey(field: string, key: string) {
  return Raw((alias) => `${alias} ? :key`, { key });
}
