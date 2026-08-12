/**
 * [PRME-INFRA-006] 请求日志中间件单元测试
 * 测试范围: requestLogger
 * 最后更新: 2026-06-20
 */
import { requestLogger } from '../../src/middleware/logger.middleware';
import logger from '../../src/utils/logger';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('requestLogger', () => {
  it('should log request on finish', () => {
    const res: any = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event, cb) => {
        if (event === 'finish') cb();
      }),
    };
    const req: any = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
    };
    const next = jest.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('GET /api/test', expect.objectContaining({
      status: 200,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    }));
  });

  it('should handle missing user-agent', () => {
    const res: any = {
      statusCode: 404,
      on: jest.fn().mockImplementation((event, cb) => {
        if (event === 'finish') cb();
      }),
    };
    const req: any = {
      method: 'POST',
      path: '/api/login',
      ip: '::1',
      get: jest.fn().mockReturnValue(undefined),
    };
    const next = jest.fn();

    requestLogger(req, res, next);
    expect(logger.info).toHaveBeenCalledWith('POST /api/login', expect.objectContaining({
      userAgent: undefined,
    }));
  });
});
