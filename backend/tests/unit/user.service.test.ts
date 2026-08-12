/**
 * [PRME-TS-002] user.service 单元测试
 * 测试范围: getProfile, updateProfile, getPreferences, updatePreferences, getUsers, deleteUser
 * 最后更新: 2026-06-24
 */
import { UserService } from '../../src/services/user.service';
import { AppDataSource } from '../../src/config/database';
import { Like } from 'typeorm';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  save: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockReturnValue({}),
});

const createMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue(mockRepo()),
});

(Object.assign as any)(AppDataSource, createMockDataSource());

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return profile without password_hash', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', username: 'test', password_hash: 'secret' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.getProfile('u1');
      expect(result).toHaveProperty('user_id');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw if user not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await expect(UserService.getProfile('unknown')).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', username: 'old' });
      repo.save.mockResolvedValue({ user_id: 'u1', username: 'new' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.updateProfile('u1', { username: 'new' });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw if user not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await expect(UserService.updateProfile('unknown', {})).rejects.toThrow('User not found');
    });
  });

  describe('getPreferences', () => {
    it('should return preferences', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', preferences: { theme: 'dark' } });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.getPreferences('u1');
      expect(result).toEqual({ theme: 'dark' });
    });

    it('should return empty object if no preferences', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.getPreferences('u1');
      expect(result).toEqual({});
    });

    it('should return empty object if user not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.getPreferences('unknown');
      expect(result).toEqual({});
    });
  });

  describe('updatePreferences', () => {
    it('should merge preferences', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', preferences: { theme: 'dark' } });
      repo.save.mockResolvedValue({ user_id: 'u1', preferences: { theme: 'dark', lang: 'zh' } });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.updatePreferences('u1', { lang: 'zh' });
      expect(result).toEqual({ theme: 'dark', lang: 'zh' });
    });

    it('should throw if user not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await expect(UserService.updatePreferences('unknown', {})).rejects.toThrow('User not found');
    });
  });

  describe('getUsers', () => {
    it('should return paginated users without password', async () => {
      const repo = mockRepo();
      repo.findAndCount.mockResolvedValue([
        [{ user_id: 'u1', username: 'a', password_hash: 'x' }, { user_id: 'u2', username: 'b', password_hash: 'y' }],
        2,
      ]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.getUsers(1, 10);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).not.toHaveProperty('password_hash');
      expect(result.total).toBe(2);
    });

    it('should use default pagination and no filters', async () => {
      const repo = mockRepo();
      repo.findAndCount.mockResolvedValue([[], 0]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await (UserService as any).getUsers();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should filter by status', async () => {
      const repo = mockRepo();
      repo.findAndCount.mockResolvedValue([[], 0]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await UserService.getUsers(1, 10, { status: 'active' });
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }));
    });

    it('should filter by search with Like', async () => {
      const repo = mockRepo();
      repo.findAndCount.mockResolvedValue([[], 0]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await UserService.getUsers(1, 10, { search: 'test' });
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          username: expect.any(Object), // Like instance
        }),
      }));
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', status: 'active' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await UserService.deleteUser('u1');
      expect(result).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'deleted' }));
    });

    it('should throw if user not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await expect(UserService.deleteUser('unknown')).rejects.toThrow('User not found');
    });
  });
});
