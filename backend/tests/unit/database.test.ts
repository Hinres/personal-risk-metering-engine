/**
 * [PRME-INFRA-003] database.ts 单元测试
 * 测试范围: initializeDatabase, closeDatabase 分支
 * 最后更新: 2026-07-08
 */

// 在模块加载前设置环境变量
const originalEnv = { ...process.env };

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DB_TYPE = 'sqlite';
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_HOST;
  delete process.env.DB_PORT;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_SCHEMA;
  delete process.env.DB_POOL_MAX;
  delete process.env.DB_POOL_MIN;
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

// Mock TypeORM 所有导出（包括装饰器），避免加载实体时出错
jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    DataSource: jest.fn().mockImplementation(() => ({
      query: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      isInitialized: false,
    })),
  };
});

jest.mock('sqlite3', () => ({
  verbose: jest.fn().mockReturnValue({
    Database: jest.fn().mockImplementation(() => ({
      exec: jest.fn((sql: string, cb: Function) => cb(null)),
      close: jest.fn(),
    })),
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/dbTypes', () => ({
  getDbType: jest.fn().mockReturnValue('sqlite'),
  setDbType: jest.fn(),
  JsonColumn: jest.fn().mockReturnValue(() => {}),
  DateTimeColumn: jest.fn().mockReturnValue(() => {}),
  getJsonType: jest.fn().mockReturnValue('simple-json'),
  getDateTimeType: jest.fn().mockReturnValue('datetime'),
  getJsonbIndexSql: jest.fn().mockReturnValue(''),
}));

describe('database.ts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should initialize sqlite database and create views', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DB_TYPE = 'sqlite';
      jest.resetModules();

      const { initializeDatabase, AppDataSource } = await import('../../src/config/database');
      (AppDataSource as any).initialize = jest.fn().mockResolvedValue(undefined);
      (AppDataSource as any).query = jest.fn().mockResolvedValue(undefined);
      (AppDataSource as any).isInitialized = false;

      const ds = await initializeDatabase(1);
      expect((AppDataSource as any).initialize).toHaveBeenCalled();
      expect(ds).toBeDefined();
    });

    it('should retry on failure and eventually succeed', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DB_TYPE = 'sqlite';
      jest.resetModules();

      const { initializeDatabase, AppDataSource } = await import('../../src/config/database');
      (AppDataSource as any).initialize = jest.fn()
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(undefined);
      (AppDataSource as any).query = jest.fn().mockResolvedValue(undefined);
      (AppDataSource as any).isInitialized = false;

      const ds = await initializeDatabase(3);
      expect((AppDataSource as any).initialize).toHaveBeenCalledTimes(2);
      expect(ds).toBeDefined();
    });

    it('should throw after max retries', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DB_TYPE = 'sqlite';
      jest.resetModules();

      const { initializeDatabase, AppDataSource } = await import('../../src/config/database');
      (AppDataSource as any).initialize = jest.fn().mockRejectedValue(new Error('Connection refused'));
      (AppDataSource as any).isInitialized = false;

      await expect(initializeDatabase(2)).rejects.toThrow('Failed to connect to database after 2 attempts');
      expect((AppDataSource as any).initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('closeDatabase', () => {
    it('should destroy when initialized', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DB_TYPE = 'sqlite';
      jest.resetModules();

      const { closeDatabase, AppDataSource } = await import('../../src/config/database');
      (AppDataSource as any).destroy = jest.fn().mockResolvedValue(undefined);
      (AppDataSource as any).isInitialized = true;
      await closeDatabase();
      expect((AppDataSource as any).destroy).toHaveBeenCalled();
    });

    it('should do nothing when not initialized', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DB_TYPE = 'sqlite';
      jest.resetModules();

      const { closeDatabase, AppDataSource } = await import('../../src/config/database');
      (AppDataSource as any).destroy = jest.fn().mockResolvedValue(undefined);
      (AppDataSource as any).isInitialized = false;
      await closeDatabase();
      expect((AppDataSource as any).destroy).not.toHaveBeenCalled();
    });
  });
});
