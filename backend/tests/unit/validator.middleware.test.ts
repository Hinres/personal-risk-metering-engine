/**
 * [PRME-INFRA-006] Zod 验证中间件单元测试
 * 测试范围: validate, validateQuery
 * 最后更新: 2026-06-20
 */
import { z } from 'zod';
import { validate, validateQuery } from '../../src/middleware/validator.middleware';
import { errorResponse } from '../../src/utils/response';

jest.mock('../../src/utils/response', () => ({
  errorResponse: jest.fn().mockReturnValue({ success: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validate', () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it('should call next for valid body', () => {
    const req: any = { body: { name: 'John', age: 30 } };
    const res: any = {};
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(errorResponse).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid body', () => {
    const req: any = { body: { name: 'John', age: 'not-a-number' } };
    const res: any = {};
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Validation failed', 400, expect.any(Array));
  });

  it('should return 400 for missing field', () => {
    const req: any = { body: { name: 'John' } };
    const res: any = {};
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Validation failed', 400, expect.any(Array));
  });
});

describe('validateQuery', () => {
  const schema = z.object({ page: z.string(), limit: z.string() });

  it('should call next for valid query', () => {
    const req: any = { query: { page: '1', limit: '10' } };
    const res: any = {};
    const next = jest.fn();
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(errorResponse).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid query', () => {
    const req: any = { query: { page: '1' } };
    const res: any = {};
    const next = jest.fn();
    validateQuery(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Query validation failed', 400, expect.any(Array));
  });
});
