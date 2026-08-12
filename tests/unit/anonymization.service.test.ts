/**
 * [PRME-INFRA-002] anonymization.service 单元测试
 * 测试范围: anonymizeTable, runAnonymizationPipeline, getHistory
 * 最后更新: 2026-06-24
 */
import { AnonymizationService } from '../../src/services/anonymization.service';
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
  create: jest.fn().mockReturnValue({ log_id: 'l1' }),
  save: jest.fn().mockResolvedValue({ log_id: 'l1' }),
});

const createMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue(mockRepo()),
  query: jest.fn().mockResolvedValue({ changes: 5 }),
});

(Object.assign as any)(AppDataSource, createMockDataSource());

describe('AnonymizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('anonymizeTable', () => {
    it('should dry run without executing', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
      }, true);
      expect(result.recordsProcessed).toBe(0);
      expect(result.fieldsAnonymized).toContain('username');
    });

    it('should execute anonymization', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [
          { column: 'username', method: 'hash' },
          { column: 'email', method: 'mask', options: { maskChar: '*', visiblePrefix: 2, visibleSuffix: 4 } },
          { column: 'avatar_url', method: 'remove' },
        ],
      });
      expect(result.recordsProcessed).toBe(5);
      expect(result.fieldsAnonymized).toHaveLength(3);
    });

    it('should handle generalize for non-IP column', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'test',
        rules: [{ column: 'segment', method: 'generalize', options: { keepSegments: 1 } }],
      });
      expect(result.fieldsAnonymized).toContain('segment');
    });

    it('should handle mask with short visible parts', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'email', method: 'mask', options: { maskChar: '*', visiblePrefix: 1, visibleSuffix: 1 } }],
      });
      expect(result.fieldsAnonymized).toContain('email');
    });

    it('should apply generalize to IP-like value', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('192.168.1.1', 'generalize', { keepSegments: 2 });
      expect(result).toBe('192.168.0.0');
    });

    it('should apply generalize to non-IP value', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('hello-world', 'generalize', { keepSegments: 2 });
      expect(result).toBe('hello-world');
    });

    it('should mask short value (<= prefix+suffix)', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('ab', 'mask', { maskChar: '*', visiblePrefix: 2, visibleSuffix: 2 });
      expect(result).toBe('ab');
    });

    it('should apply mask with default options', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('longvalue', 'mask');
      expect(result).toContain('****');
    });

    it('should apply truncate with default options', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('verylongstringthatexceeds20', 'truncate');
      expect(result).toHaveLength(20);
    });

    it('should apply generalize with default options', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('192.168.1.1', 'generalize');
      expect(result).toBe('192.168.0.0');
    });

    it('should return value for unknown method', async () => {
      const result = (AnonymizationService as any).applyAnonymizationMethod('test', 'unknown');
      expect(result).toBe('test');
    });

    it('should handle truncate', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'audit_logs',
        rules: [{ column: 'user_agent', method: 'truncate', options: { maxLength: 20 } }],
      });
      expect(result.fieldsAnonymized).toContain('user_agent');
    });

    it('should handle anonymization with where clause', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
        where: "status != 'deleted'",
      });
      expect(result.recordsProcessed).toBe(5);
      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status != 'deleted'")
      );
    });

    it('should handle query returning null', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue(null);
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
      });
      expect(result.recordsProcessed).toBe(0);
    });

    it('should handle query returning undefined', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue(undefined);
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
      });
      expect(result.recordsProcessed).toBe(0);
    });

    it('should handle dry run with where clause', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
        where: "status = 'active'",
      }, true);
      expect(result.recordsProcessed).toBe(0);
    });

    it('should handle generalize for IP address column', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'logs',
        rules: [{ column: 'ip_address', method: 'generalize', options: { keepSegments: 2 } }],
      });
      expect(result.fieldsAnonymized).toContain('ip_address');
    });

    it('should handle generalize for IP with non-default keepSegments', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'logs',
        rules: [{ column: 'ip_address', method: 'generalize', options: { keepSegments: 1 } }],
      });
      expect(result.fieldsAnonymized).toContain('ip_address');
    });

    it('should handle query returning undefined', async () => {
      const repo = mockRepo();
      repo.findOne.mockResolvedValue({ user_id: 'u1', username: 'test' });
      (AppDataSource.query as jest.Mock).mockResolvedValue(undefined);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'username', method: 'hash' }],
      });
      expect(result.recordsProcessed).toBe(0);
    });

    it('should use default options when mask options omitted', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [{ column: 'email', method: 'mask' }],
      });
      expect(result.fieldsAnonymized).toContain('email');
    });

    it('should use default options when truncate options omitted', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'audit_logs',
        rules: [{ column: 'user_agent', method: 'truncate' }],
      });
      expect(result.fieldsAnonymized).toContain('user_agent');
    });

    it('should use default options when generalize options omitted', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'logs',
        rules: [{ column: 'ip_address', method: 'generalize' }],
      });
      expect(result.fieldsAnonymized).toContain('ip_address');
    });

    it('should return empty for no rules', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'users',
        rules: [],
      });
      expect(result.recordsProcessed).toBe(0);
      expect(result.fieldsAnonymized).toHaveLength(0);
    });
  });

  describe('runAnonymizationPipeline', () => {
    it('should run full pipeline', async () => {
      const repo = mockRepo();
      repo.save.mockResolvedValue({ log_id: 'l1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await AnonymizationService.runAnonymizationPipeline(false);
      expect(result).toHaveProperty('logId');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalRecords');
      expect(result.status).toBe('completed');
    });

    it('should run dry run pipeline', async () => {
      const repo = mockRepo();
      repo.save.mockResolvedValue({ log_id: 'l1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await AnonymizationService.runAnonymizationPipeline(true);
      expect(result.status).toBe('dry_run_completed');
    });

    it('should handle pipeline failure', async () => {
      const repo = mockRepo();
      repo.save.mockResolvedValue({ log_id: 'l1' });
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);
      (AppDataSource.query as jest.Mock).mockRejectedValue(new Error('DB locked'));

      await expect(AnonymizationService.runAnonymizationPipeline(false))
        .rejects.toThrow('DB locked');
    });
  });

  describe('getHistory', () => {
    it('should return history', async () => {
      const repo = mockRepo();
      repo.find.mockResolvedValue([{ log_id: 'l1' }, { log_id: 'l2' }]);
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);

      const result = await AnonymizationService.getHistory(10);
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });
  });
});
