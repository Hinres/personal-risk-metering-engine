/**
 * [PRME-INFRA-006] 错误处理中间件单元测试
 * 测试范围: errorHandler
 * 最后更新: 2026-06-20
 */
import { errorHandler } from '../../src/middleware/error.middleware';
import { errorResponse } from '../../src/utils/response';

jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), on: jest.fn() };
  return res;
};

const mockNext = jest.fn();

describe('errorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('should handle generic error with 500', () => {
    const res = mockResponse();
    const err = new Error('Something broke');
    errorHandler(err, { path: '/test', method: 'GET' } as any, res, mockNext);
    expect(errorResponse).toHaveBeenCalledWith(res, 'Internal Server Error', 500, undefined);
  });

  it('should include error message in development', () => {
    process.env.NODE_ENV = 'development';
    const res = mockResponse();
    const err = new Error('Dev error');
    errorHandler(err, { path: '/test', method: 'GET' } as any, res, mockNext);
    expect(errorResponse).toHaveBeenCalledWith(res, 'Internal Server Error', 500, 'Dev error');
  });

  it('should handle ValidationError with 400', () => {
    const res = mockResponse();
    const err = new Error('Invalid input');
    (err as any).name = 'ValidationError';
    errorHandler(err, { path: '/test', method: 'POST' } as any, res, mockNext);
    expect(errorResponse).toHaveBeenCalledWith(res, 'Validation Error', 400, 'Invalid input');
  });

  it('should handle UnauthorizedError with 401', () => {
    const res = mockResponse();
    const err = new Error('Unauthorized');
    (err as any).name = 'UnauthorizedError';
    errorHandler(err, { path: '/test', method: 'GET' } as any, res, mockNext);
    expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized', 401);
  });

  it('should handle NotFoundError with 404', () => {
    const res = mockResponse();
    const err = new Error('Not found');
    (err as any).name = 'NotFoundError';
    errorHandler(err, { path: '/test', method: 'GET' } as any, res, mockNext);
    expect(errorResponse).toHaveBeenCalledWith(res, 'Not Found', 404);
  });
});
