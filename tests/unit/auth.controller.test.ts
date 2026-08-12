/**
 * [PRME-TS-002] auth.controller 单元测试
 * 测试范围: register, login, logout, refresh, wechatLogin, getProfile
 * 最后更新: 2026-06-20
 */
import { register, login, logout, refresh, wechatLogin, getProfile } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';
import { UserService } from '../../src/services/user.service';
import { successResponse, errorResponse } from '../../src/utils/response';
import { ValidationError } from '../../src/utils/errors';

jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/user.service');
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockReq = (body: any = {}, headers: any = {}, user: any = null) => ({
  body,
  headers,
  user,
  ip: '127.0.0.1',
  get: jest.fn(),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('auth.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const req = mockReq({ username: 'test', email: 'test@test.com', password: 'pass' });
      const res = mockRes();
      (AuthService.register as jest.Mock).mockResolvedValue({ user_id: 'u1' });
      await register(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { user_id: 'u1' }, 'Registration successful', 201);
    });

    it('should handle registration error', async () => {
      const req = mockReq({ username: 'test', email: 'test@test.com', password: 'pass' });
      const res = mockRes();
      (AuthService.register as jest.Mock).mockRejectedValue(new Error('User exists'));
      await register(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'User exists', 409);
    });

    it('should handle validation error', async () => {
      const req = mockReq({ username: 'test', email: 'bad-email', password: 'pass' });
      const res = mockRes();
      (AuthService.register as jest.Mock).mockRejectedValue(new ValidationError('Invalid email'));
      await register(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Invalid email', 409);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const req = mockReq({ username: 'test', password: 'pass' });
      const res = mockRes();
      (AuthService.login as jest.Mock).mockResolvedValue({ token: 't1' });
      await login(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { token: 't1' }, 'Login successful');
    });

    it('should handle login error', async () => {
      const req = mockReq({ username: 'test', password: 'wrong' });
      const res = mockRes();
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
      await login(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Invalid credentials', 401);
    });

    it('should handle login with no ip and no user-agent', async () => {
      const req = { body: { username: 'test', password: 'pass' }, ip: undefined, socket: { remoteAddress: undefined }, get: jest.fn().mockReturnValue(undefined) };
      const res = mockRes();
      (AuthService.login as jest.Mock).mockResolvedValue({ token: 't1' });
      await login(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { token: 't1' }, 'Login successful');
    });

    it('should handle login with socket remoteAddress', async () => {
      const req = { body: { username: 'test', password: 'pass' }, ip: undefined, socket: { remoteAddress: '10.0.0.1' }, get: jest.fn().mockReturnValue('agent') };
      const res = mockRes();
      (AuthService.login as jest.Mock).mockResolvedValue({ token: 't1' });
      await login(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { token: 't1' }, 'Login successful');
    });
  });

  describe('logout', () => {
    it('should logout with token', async () => {
      const req = mockReq({}, { authorization: 'Bearer token123' });
      const res = mockRes();
      (AuthService.logout as jest.Mock).mockResolvedValue(undefined);
      await logout(req as any, res);
      expect(AuthService.logout).toHaveBeenCalledWith('token123');
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Logout successful');
    });

    it('should logout without token', async () => {
      const req = mockReq({}, {});
      const res = mockRes();
      await logout(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Logout successful');
    });

    it('should handle logout error', async () => {
      const req = mockReq({}, { authorization: 'Bearer token123' });
      const res = mockRes();
      (AuthService.logout as jest.Mock).mockRejectedValue(new Error('DB error'));
      await logout(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('refresh', () => {
    it('should refresh token', async () => {
      const req = mockReq({ refresh_token: 'rt1' });
      const res = mockRes();
      (AuthService.refresh as jest.Mock).mockResolvedValue({ token: 'new' });
      await refresh(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { token: 'new' }, 'Token refreshed');
    });

    it('should handle refresh error', async () => {
      const req = mockReq({ refresh_token: 'rt1' });
      const res = mockRes();
      (AuthService.refresh as jest.Mock).mockRejectedValue(new Error('Invalid refresh token'));
      await refresh(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Invalid refresh token', 401);
    });
  });

  describe('wechatLogin', () => {
    it('should login with wechat code', async () => {
      const req = mockReq({ code: 'wx123', userInfo: {} });
      const res = mockRes();
      (AuthService.wechatLogin as jest.Mock).mockResolvedValue({ token: 'wx_token' });
      await wechatLogin(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { token: 'wx_token' }, 'WeChat login successful');
    });

    it('should reject missing code', async () => {
      const req = mockReq({});
      const res = mockRes();
      await wechatLogin(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Missing code parameter', 400);
    });

    it('should handle wechat login error with no message', async () => {
      const req = mockReq({ code: 'wx123' });
      const res = mockRes();
      (AuthService.wechatLogin as jest.Mock).mockRejectedValue({});
      await wechatLogin(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'WeChat login failed', 500);
    });

    it('should handle wechat login error', async () => {
      const req = mockReq({ code: 'wx123' });
      const res = mockRes();
      (AuthService.wechatLogin as jest.Mock).mockRejectedValue(new Error('WeChat API error'));
      await wechatLogin(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'WeChat API error', 500);
    });
  });

  describe('getProfile', () => {
    it('should get profile', async () => {
      const req = mockReq({}, {}, { user_id: 'u1' });
      const res = mockRes();
      (UserService.getProfile as jest.Mock).mockResolvedValue({ user_id: 'u1', name: 'Test' });
      await getProfile(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { user_id: 'u1', name: 'Test' });
    });

    it('should handle profile error', async () => {
      const req = mockReq({}, {}, { user_id: 'u1' });
      const res = mockRes();
      (UserService.getProfile as jest.Mock).mockRejectedValue(new Error('Not found'));
      await getProfile(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Not found', 404);
    });
  });
});
