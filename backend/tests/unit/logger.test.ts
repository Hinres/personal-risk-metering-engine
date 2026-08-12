/**
 * [PRME-PA-001] logger 单元测试
 * 测试范围: logger 基本行为
 * 最后更新: 2026-07-08
 */

const mockCreateLogger = jest.fn().mockReturnValue({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const mockConsoleTransport = jest.fn();
const mockDailyRotateFile = jest.fn();

jest.mock('winston', () => ({
  createLogger: mockCreateLogger,
  transports: { Console: mockConsoleTransport },
  format: {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    errors: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    colorize: jest.fn().mockReturnValue({}),
    printf: jest.fn().mockImplementation((fn) => {
      // 测试 printf 的两种分支：有 meta 和没有 meta
      const withMeta = fn({ timestamp: '2026-01-01', level: 'info', message: 'test', extra: 'data' });
      const withoutMeta = fn({ timestamp: '2026-01-01', level: 'info', message: 'test' });
      return { withMeta, withoutMeta };
    }),
  },
}));

jest.mock('winston-daily-rotate-file', () => mockDailyRotateFile);

describe('logger', () => {
  it('should use LOG_DIR when provided', () => {
    const originalLogDir = process.env.LOG_DIR;
    process.env.LOG_DIR = '/custom/logs';
    jest.resetModules();
    jest.unmock('../../src/utils/logger');
    const path = require('path');
    const joinSpy = jest.spyOn(path, 'join');
    const logger = require('../../src/utils/logger').default;
    expect(mockCreateLogger).toHaveBeenCalled();
    expect(joinSpy).not.toHaveBeenCalledWith(expect.stringContaining('logs'));
    joinSpy.mockRestore();
    process.env.LOG_DIR = originalLogDir;
  });
});
