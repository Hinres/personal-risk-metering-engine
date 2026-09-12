/**
 * [PRME-PA-001] jwt 单元测试
 * 测试范围: JWT_CONFIG, env handling
 * 最后更新: 2026-09-09
 *
 * [QA建议] 本文件自包含：dotenv 用例通过 jest.mock 模拟，
 * 不再依赖 cwd/backend 目录下真实存在 .env 文件（archive 提取目录无 .env 时也能通过）
 */

// 模拟 dotenv：当 jwt.ts 在非 test 环境且缺少 JWT_SECRET 时调用 dotenv.config()，
// 由 mock 注入测试用密钥，避免依赖仓库中真实的 .env 文件
jest.mock('dotenv', () => ({
  config: jest.fn((options?: any) => {
    process.env.JWT_SECRET = 'dotenv-loaded-secret-for-test';
    return { parsed: { JWT_SECRET: 'dotenv-loaded-secret-for-test' } };
  }),
}));

describe('jwt.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret-key-for-jwt-only' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should export JWT_CONFIG with defaults', () => {
    const { JWT_CONFIG } = require('../../src/config/jwt');
    expect(JWT_CONFIG.secret).toBe('test-secret-key-for-jwt-only');
    expect(JWT_CONFIG.expiresIn).toBe('24h');
    expect(JWT_CONFIG.refreshExpiresIn).toBe('7d');
  });

  it('should use custom expiresIn', () => {
    process.env.JWT_EXPIRES_IN = '12h';
    process.env.JWT_REFRESH_EXPIRES_IN = '3d';
    jest.resetModules();
    const { JWT_CONFIG } = require('../../src/config/jwt');
    expect(JWT_CONFIG.expiresIn).toBe('12h');
    expect(JWT_CONFIG.refreshExpiresIn).toBe('3d');
  });

  it('should throw when JWT_SECRET is missing', () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    jest.resetModules();
    expect(() => require('../../src/config/jwt')).toThrow('FATAL: JWT_SECRET');
    process.env.JWT_SECRET = originalSecret;
  });

  it('should load dotenv in non-test environment when JWT_SECRET is missing', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    jest.resetModules();
    // dotenv 已被 jest.mock 接管：jwt.ts 调 dotenv.config() 后应获得 mock 注入的密钥
    const { JWT_CONFIG } = require('../../src/config/jwt');
    expect(JWT_CONFIG.secret).toBe('dotenv-loaded-secret-for-test');
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
  });
});
