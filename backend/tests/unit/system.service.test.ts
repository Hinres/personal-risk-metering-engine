/**
 * [PRME-INFRA-005] system.service 单元测试
 * 测试范围: getConfig, setConfig, getAllConfigs, deleteConfig
 * 最后更新: 2026-06-24
 */
import { SystemService } from '../../src/services/system.service';
import { AppDataSource } from '../../src/config/database';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue({}),
});

const createMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue(mockRepo()),
});

(Object.assign as any)(AppDataSource, createMockDataSource());

describe('SystemService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config value', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ config_key: 'key1', config_value: 'val1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.getConfig('key1');
      expect(result).toBe('val1');
    });

    it('should return undefined if not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.getConfig('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('setConfig', () => {
    it('should update existing config', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ config_key: 'key1', config_value: 'old' });
      repo.save.mockResolvedValue({ config_key: 'key1', config_value: 'new' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.setConfig('key1', 'new');
      expect(result.config_value).toBe('new');
    });

    it('should create new config', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ config_key: 'key2', config_value: 'val2' });
      repo.save.mockResolvedValue({ config_key: 'key2', config_value: 'val2' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.setConfig('key2', 'val2', 'custom', 'desc');
      expect(result.config_key).toBe('key2');
    });

    it('should update existing config with description', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ config_key: 'key1', config_value: 'old', description: 'old desc' });
      repo.save.mockResolvedValue({ config_key: 'key1', config_value: 'new', description: 'new desc' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.setConfig('key1', 'new', 'system', 'new desc');
      expect(result.config_value).toBe('new');
      expect(result.description).toBe('new desc');
    });
  });

  describe('getAllConfigs', () => {
    it('should return all configs', async () => {
      const repo = mockRepo();
      repo.find.mockResolvedValue([{ config_key: 'k1' }, { config_key: 'k2' }]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.getAllConfigs();
      expect(result).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const repo = mockRepo();
      repo.find.mockResolvedValue([]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      await SystemService.getAllConfigs('system');
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ config_type: 'system' }),
      }));
    });
  });

  describe('deleteConfig', () => {
    it('should delete existing config', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ config_key: 'k1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.deleteConfig('k1');
      expect(result).toBe(true);
      expect(repo.remove).toHaveBeenCalled();
    });

    it('should return false if not found', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue(null);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await SystemService.deleteConfig('missing');
      expect(result).toBe(false);
    });
  });
});
