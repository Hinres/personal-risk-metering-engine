/**
 * [PRME-TS-002] auth.service 单元测试
 * 测试范围: validatePassword, register, login, logout, refresh, isTokenBlacklisted, cleanupExpiredBlacklist, wechatLogin, updateWechatUser
 * 最后更新: 2026-06-30
 */
import { AuthService } from '../../src/services/auth.service';
import { AppDataSource } from '../../src/config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

jest.mock('axios');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/encryption', () => ({
  encrypt: jest.fn((val: string) => `encrypted_${val}`),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

const createMockRepo = (overrides?: any) => ({
  findOne: jest.fn().mockResolvedValue(null),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  ...overrides,
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockReset();
    mockedBcrypt.hash.mockReset();
    mockedBcrypt.compare.mockReset();
    mockedJwt.sign.mockReset();
    mockedJwt.decode.mockReset();
    mockedJwt.verify.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = AuthService.validatePassword('StrongP@ssw0rd');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject undefined password', () => {
      const result = AuthService.validatePassword(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject short password', () => {
      const result = AuthService.validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('长度'))).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = AuthService.validatePassword('strongp@ssw0rd');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个大写字母');
    });

    it('should reject password without lowercase', () => {
      const result = AuthService.validatePassword('STRONGP@SSW0RD');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个小写字母');
    });

    it('should reject password without digit', () => {
      const result = AuthService.validatePassword('StrongP@ssword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个数字');
    });

    it('should reject password without special char', () => {
      const result = AuthService.validatePassword('StrongPassw0rd');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个特殊字符');
    });

    it('should reject empty password', () => {
      const result = AuthService.validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('register', () => {
    it('should reject weak password', async () => {
      await expect(AuthService.register({ username: 'test', password: 'weak' }))
        .rejects.toThrow('密码不符合安全策略');
    });

    it('should reject existing user', async () => {
      const mockRepo = createMockRepo({ findOne: jest.fn().mockResolvedValue({ user_id: 'u1' }) });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      await expect(AuthService.register({ username: 'test', password: 'StrongP@ssw0rd' }))
        .rejects.toThrow('User already exists');
    });

    it('should register new user', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedBcrypt.hash.mockResolvedValue('hashed_password' as never);
      mockedJwt.sign.mockReturnValue('token' as never);

      const result = await AuthService.register({
        username: 'newuser',
        email: 'test@test.com',
        phone: '13800138000',
        password: 'StrongP@ssw0rd',
      });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should register without email and phone', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedBcrypt.hash.mockResolvedValue('hashed_password' as never);
      mockedJwt.sign.mockReturnValue('token' as never);

      const result = await AuthService.register({
        username: 'newuser2',
        password: 'StrongP@ssw0rd',
      });
      expect(result).toHaveProperty('token');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: null, phone: null }));
    });
  });

  describe('login', () => {
    it('should reject invalid user', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      await expect(AuthService.login('nonexistent', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should reject wrong password', async () => {
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue({ user_id: 'u1', password_hash: 'hash' }),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(AuthService.login('test', 'wrongpass'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should login successfully and notify security anomalies', async () => {
      const user = { user_id: 'u1', username: 'test', password_hash: 'hash', email: 'test@test.com', role: 'user' };
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockResolvedValue({ ...user, last_login: new Date() }),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedJwt.sign.mockReturnValue('token' as never);
      jest.spyOn(require('../../src/services/loginSecurity.service').LoginSecurityService, 'detectAnomalies').mockResolvedValue({
        shouldNotify: true,
        anomalies: ['new_ip'],
      });
      jest.spyOn(require('../../src/services/loginSecurity.service').LoginSecurityService, 'sendSecurityAlert').mockResolvedValue(undefined);

      const result = await AuthService.login('test', 'password');
      expect(result).toHaveProperty('token');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should reject user without password hash', async () => {
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue({ user_id: 'u1', password_hash: null }),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      await expect(AuthService.login('test', 'password'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should handle token without jti', async () => {
      mockedJwt.decode.mockReturnValue({ user_id: 'u1' } as never);
      await AuthService.logout('token');
      // Should log warning and return without throwing
    });

    it('should blacklist token with jti', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.decode.mockReturnValue({ user_id: 'u1', jti: 'jti1', exp: 1234567890 } as never);

      await AuthService.logout('token');
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should handle blacklist error gracefully', async () => {
      const mockRepo = createMockRepo({ save: jest.fn().mockRejectedValue(new Error('DB error')) });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.decode.mockReturnValue({ user_id: 'u1', jti: 'jti1', exp: 1234567890 } as never);

      await AuthService.logout('token');
      // Should not throw
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      mockedJwt.verify.mockReset();
      mockedJwt.decode.mockReset();
    });

    it('should reject blacklisted token', async () => {
      jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(true);
      mockedJwt.verify.mockReturnValue({ user_id: 'u1', jti: 'jti1' } as never);

      await expect(AuthService.refresh('token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should reject invalid token', async () => {
      mockedJwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(AuthService.refresh('token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should refresh successfully', async () => {
      const user = { user_id: 'u1', username: 'test', email: 'test@test.com', role: 'user' };
      const mockRepo = createMockRepo({ findOne: jest.fn().mockResolvedValue(user) });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.verify.mockReturnValue({ user_id: 'u1' } as never);
      jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);
      mockedJwt.sign.mockReturnValue('new_token' as never);

      const result = await AuthService.refresh('valid_token');
      expect(result).toHaveProperty('token');
    });

    it('should reject when user not found', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.verify.mockReturnValue({ user_id: 'u1' } as never);
      jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);

      await expect(AuthService.refresh('valid_token')).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for token without jti', async () => {
      mockedJwt.decode.mockReturnValue({ user_id: 'u1' } as never);
      const result = await AuthService.isTokenBlacklisted('token');
      expect(result).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue({ token_jti: 'jti1' }),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.decode.mockReturnValue({ jti: 'jti1' } as never);

      const result = await AuthService.isTokenBlacklisted('token');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
      mockedJwt.decode.mockReturnValue({ jti: 'jti1' } as never);

      const result = await AuthService.isTokenBlacklisted('token');
      expect(result).toBe(false);
    });

    it('should return false when decode throws', async () => {
      mockedJwt.decode.mockImplementation(() => { throw new Error('decode error'); });
      const result = await AuthService.isTokenBlacklisted('bad_token');
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredBlacklist', () => {
    it('should clean expired entries', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ affected: 5 });
      (AppDataSource.createQueryBuilder as jest.Mock).mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      });

      const result = await AuthService.cleanupExpiredBlacklist();
      expect(result).toBe(5);
    });

    it('should handle cleanup error', async () => {
      (AppDataSource.createQueryBuilder as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await AuthService.cleanupExpiredBlacklist();
      expect(result).toBe(0);
    });

    it('should return 0 when no expired entries', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ affected: 0 });
      (AppDataSource.createQueryBuilder as jest.Mock).mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      });

      const result = await AuthService.cleanupExpiredBlacklist();
      expect(result).toBe(0);
    });
  });

  describe('wechatLogin', () => {
    it('should create new WeChat user', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { openid: 'wx_openid_123', session_key: 'session_key_123', unionid: 'unionid_123' },
      });
      mockedJwt.sign.mockReturnValue('token' as never);

      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({ user_id: 'u1', login_count: 0 }),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.wechatLogin('code', {
        nickName: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      expect(result).toHaveProperty('token');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should handle WeChat API error response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { errcode: 40029, errmsg: 'invalid code' },
      });
      mockedJwt.sign.mockReturnValue('token' as never);

      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      await expect(AuthService.wechatLogin('invalid_code'))
        .rejects.toThrow('WeChat API error');
    });

    it('should update existing WeChat user', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { openid: 'wx_openid_123', session_key: 'session_key_456' },
      });
      mockedJwt.sign.mockReturnValue('token' as never);

      const existingUser = {
        user_id: 'u1',
        username: 'wx_wx_openid_12',
        wechat_info: { openid: 'wx_openid_123', nickName: 'OldName' },
        login_count: 5,
      };
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(existingUser),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.wechatLogin('code', { nickName: 'NewName' });
      expect(result).toHaveProperty('token');
    });

    it('should update existing WeChat user without userInfo', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { openid: 'wx_openid_123', session_key: 'session_key_789' },
      });
      mockedJwt.sign.mockReturnValue('token' as never);

      const existingUser = {
        user_id: 'u1',
        username: 'wx_wx_openid_12',
        wechat_info: { openid: 'wx_openid_123', nickName: 'OldName', gender: 1 },
        login_count: 5,
      };
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(existingUser),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.wechatLogin('code');
      expect(result).toHaveProperty('token');
    });

    it('should create new WeChat user without userInfo', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { openid: 'wx_openid_456', session_key: 'session_key_456' },
      });
      mockedJwt.sign.mockReturnValue('token' as never);

      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({ user_id: 'u2', login_count: 0 }),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.wechatLogin('code');
      expect(result).toHaveProperty('token');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        wechat_info: expect.objectContaining({ gender: 0, nickName: null, avatarUrl: null }),
      }));
    });
  });

  describe('updateWechatUser', () => {
    it('should reject non-existent user', async () => {
      const mockRepo = createMockRepo();
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      await expect(AuthService.updateWechatUser('nonexistent', {}))
        .rejects.toThrow('User not found');
    });

    it('should update WeChat user info', async () => {
      const user = {
        user_id: 'u1',
        username: 'test',
        avatar_url: null,
        wechat_info: { nickName: 'Old' },
      };
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.updateWechatUser('u1', { nickName: 'New', avatarUrl: 'https://example.com/new.jpg' });
      expect(result.wechat_info.nickName).toBe('New');
      expect(result.avatar_url).toBe('https://example.com/new.jpg');
    });

    it('should update WeChat user info without avatarUrl', async () => {
      const user = {
        user_id: 'u1',
        username: 'test',
        avatar_url: null,
        wechat_info: { nickName: 'Old' },
      };
      const mockRepo = createMockRepo({
        findOne: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation((u: any) => Promise.resolve(u)),
      });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

      const result = await AuthService.updateWechatUser('u1', { nickName: 'New' });
      expect(result.wechat_info.nickName).toBe('New');
      expect(result.avatar_url).toBeNull();
    });
  });
});
