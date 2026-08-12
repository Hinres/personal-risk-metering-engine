/**
 * [PRME-PA-001] jwt 单元测试
 * 测试范围: JWT_CONFIG, env handling
 * 最后更新: 2026-07-08
 */

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
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    jest.resetModules();
    // dotenv should load .env and provide JWT_SECRET
    const { JWT_CONFIG } = require('../../src/config/jwt');
    expect(JWT_CONFIG.secret).toBeDefined();
    expect(JWT_CONFIG.secret.length).toBeGreaterThan(0);
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  });
});
