/**
 * Jest 全局测试设置
 * P1-6: 确保测试环境默认使用 SQLite，避免实体装饰器在加载时错误解析类型
 */

// Jest 兼容: Node.js 20+ 中 path-scurry 依赖 fs.native
const fsModule = require('fs');
if (!fsModule.native) {
  Object.defineProperty(fsModule, 'native', { value: fsModule, writable: false });
}

import { setDbType } from '../src/utils/dbTypes';

// 强制测试环境使用 SQLite
process.env.DB_TYPE = 'sqlite';
setDbType('sqlite');

// JWT 密钥（测试环境必需）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';

// 加密密钥（测试环境必需）
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-bytes-long!!';

// 日志目录（避免 EACCES）
process.env.LOG_DIR = '/tmp/prme-test-logs';

// 测试环境跳过 SQLite 视图创建（避免 TypeORM synchronize 冲突）
process.env.SKIP_SQLITE_VIEWS = 'true';

// 清理测试数据库文件（避免跨测试污染）
import * as fs from 'fs';
import * as path from 'path';

const workerId = process.env.JEST_WORKER_ID || '0';
const testDbPath = path.resolve(__dirname, `../data/test-database-${workerId}.sqlite`);

// 删除旧数据库
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// 每个 worker 使用独立的数据库文件
process.env.SQLITE_DB_PATH = testDbPath;
