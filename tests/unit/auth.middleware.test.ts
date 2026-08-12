/**
 * [PRME-INFRA-001] 认证中间件单元测试
 * 测试范围: authMiddleware, adminMiddleware
 * 最后更新: 2026-06-20
 */
import { authMiddleware, adminMiddleware } from '../../src/middleware/auth.middleware';
import { errorResponse } from '../../src/utils/response';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../src/services/auth.service';

jest.mock('jsonwebtoken');
jest.mock('../../src/utils/response');
jest.mock('../../src/services/auth.service');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject missing authorization header', async () => {
    const req: any = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized - No token provided', 401);
  });

  it('should reject non-Bearer token', async () => {
    const req: any = { headers: { authorization: 'Basic abc123' } };
    const res = mockResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized - No token provided', 401);
  });

  it('should reject blacklisted token', async () => {
    (AuthService.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);
    const req: any = { headers: { authorization: 'Bearer blacklisted' } };
    const res = mockResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Token has been revoked', 401);
  });

  it('should set user and call next for valid token', async () => {
    (AuthService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
    (jwt.verify as jest.Mock).mockReturnValue({ user_id: 'u1', role: 'user' });
    const req: any = { headers: { authorization: 'Bearer valid_token' } };
    const res = mockResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ user_id: 'u1', role: 'user' });
  });

  it('should reject invalid token', async () => {
    (AuthService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid token'); });
    const req: any = { headers: { authorization: 'Bearer invalid' }, path: '/test' };
    const res = mockResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized - Invalid token', 401);
  });
});

describe('adminMiddleware', () => {
  it('should reject non-admin users', () => {
    const req: any = { user: { user_id: 'u1', role: 'user' } };
    const res = mockResponse();
    const next = jest.fn();
    adminMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Forbidden - Admin access required', 403);
  });

  it('should reject missing user', () => {
    const req: any = {};
    const res = mockResponse();
    const next = jest.fn();
    adminMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, 'Forbidden - Admin access required', 403);
  });

  it('should allow admin users', () => {
    const req: any = { user: { user_id: 'a1', role: 'admin' } };
    const res = mockResponse();
    const next = jest.fn();
    adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});