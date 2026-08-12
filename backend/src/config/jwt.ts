/**
 * [PRME-INFRA-001] 认证与授权
 * 文件: jwt.ts
 * 需求描述: 认证与授权功能实现
 * 最后更新: 2026-07-01
 */
// BUG-FIX: tsx 预加载时 dotenv 可能尚未加载，jwt.ts 自行确保环境变量可读
import path from 'path';
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
