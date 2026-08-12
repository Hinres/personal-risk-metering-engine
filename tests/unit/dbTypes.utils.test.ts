/**
 * [PRME-INFRA-006] P1-6 数据库类型辅助工具单元测试
 * 测试范围: getDbType, setDbType, getJsonType, getDateTimeType, getJsonbIndexSql
 * 最后更新: 2026-06-20
 */
import { getDbType, setDbType, getJsonType, getDateTimeType, getJsonbIndexSql } from '../../src/utils/dbTypes';

describe('dbTypes', () => {
  beforeEach(() => {
    // Reset internal state by setting to a known value
    setDbType('sqlite');
  });

  describe('getDbType', () => {
    it('should return sqlite by default', () => {
      expect(getDbType()).toBe('sqlite');
    });

    it('should return postgres when set explicitly', () => {
      setDbType('postgres');
      expect(getDbType()).toBe('postgres');
    });

    it('should return cached value without re-checking env', () => {
      setDbType('sqlite');
      const original = process.env.DB_TYPE;
      process.env.DB_TYPE = 'mysql';
      // getDbType returns cached _dbType, does not re-read env
      expect(getDbType()).toBe('sqlite');
      process.env.DB_TYPE = original;
    });

    it('should warn and fallback to sqlite for unknown env type when cache is empty', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      // Reset internal cache to force env re-read
      jest.resetModules();
      delete require.cache[require.resolve('../../src/utils/dbTypes')];
      const original = process.env.DB_TYPE;
      process.env.DB_TYPE = 'mysql';
      const { getDbType: getDbTypeFresh } = require('../../src/utils/dbTypes');
      expect(getDbTypeFresh()).toBe('sqlite');
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Unknown DB_TYPE'));
      process.env.DB_TYPE = original;
      consoleWarn.mockRestore();
    });
  });

  describe('setDbType', () => {
    it('should set db type explicitly', () => {
      setDbType('postgres');
      expect(getDbType()).toBe('postgres');
    });

    it('should log type change', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();
      setDbType('postgres');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('postgres'));
      consoleLog.mockRestore();
    });
  });

  describe('getJsonType', () => {
    it('should return simple-json for sqlite', () => {
      setDbType('sqlite');
      expect(getJsonType()).toBe('simple-json');
    });

    it('should return jsonb for postgres', () => {
      setDbType('postgres');
      expect(getJsonType()).toBe('jsonb');
    });
  });

  describe('getDateTimeType', () => {
    it('should return datetime for sqlite', () => {
      setDbType('sqlite');
      expect(getDateTimeType()).toBe('datetime');
    });

    it('should return timestamp for postgres', () => {
      setDbType('postgres');
      expect(getDateTimeType()).toBe('timestamp');
    });
  });

  describe('getJsonbIndexSql', () => {
    it('should return empty string for sqlite', () => {
      setDbType('sqlite');
      expect(getJsonbIndexSql('my_table', 'my_column', 'idx_test')).toBe('');
    });

    it('should return GIN index SQL for postgres', () => {
      setDbType('postgres');
      const sql = getJsonbIndexSql('my_table', 'my_column', 'idx_test');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
      expect(sql).toContain('"idx_test"');
      expect(sql).toContain('USING GIN');
      expect(sql).toContain('"my_table"');
      expect(sql).toContain('"my_column"');
    });
  });

  describe('JsonColumn and DateTimeColumn decorators', () => {
    afterEach(() => {
      jest.resetModules();
      jest.dontMock('typeorm');
    });

    it('should use simple-json and datetime for sqlite', () => {
      jest.resetModules();
      process.env.DB_TYPE = 'sqlite';
      const decoratorFn = jest.fn();
      const ColumnMock = jest.fn().mockReturnValue(decoratorFn);
      jest.doMock('typeorm', () => ({ Column: ColumnMock }));
      const { JsonColumn, DateTimeColumn } = require('../../src/utils/dbTypes');
      class TestEntity {}
      JsonColumn()(TestEntity.prototype, 'data');
      DateTimeColumn()(TestEntity.prototype, 'createdAt');
      expect(ColumnMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'simple-json' }));
      expect(ColumnMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'datetime' }));
      expect(decoratorFn).toHaveBeenCalledWith(TestEntity.prototype, 'data');
      expect(decoratorFn).toHaveBeenCalledWith(TestEntity.prototype, 'createdAt');
    });

    it('should use jsonb and timestamp for postgres', () => {
      jest.resetModules();
      process.env.DB_TYPE = 'postgres';
      const decoratorFn = jest.fn();
      const ColumnMock = jest.fn().mockReturnValue(decoratorFn);
      jest.doMock('typeorm', () => ({ Column: ColumnMock }));
      const { JsonColumn, DateTimeColumn } = require('../../src/utils/dbTypes');
      class TestEntity {}
      JsonColumn()(TestEntity.prototype, 'data');
      DateTimeColumn()(TestEntity.prototype, 'createdAt');
      expect(ColumnMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'jsonb' }));
      expect(ColumnMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'timestamp' }));
      expect(decoratorFn).toHaveBeenCalledWith(TestEntity.prototype, 'data');
      expect(decoratorFn).toHaveBeenCalledWith(TestEntity.prototype, 'createdAt');
    });
  });
});
