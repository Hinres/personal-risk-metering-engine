/**
 * [PRME-PA-001] auditLogIntegrity.service 单元测试
 * 测试范围: computeLogHash, recordIntegrity, verifyChain, verifyLog, getStats
 * 最后更新: 2026-07-11
 */

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AuditLogIntegrityService } from '../../src/services/auditLogIntegrity.service';
import { AppDataSource } from '../../src/config/database';

describe('AuditLogIntegrityService', () => {
  let repo: any;

  const mockIntegrityRepo = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
  });

  beforeEach(() => {
    repo = mockIntegrityRepo();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeLogHash', () => {
    it('should compute consistent hash', () => {
      const logData = {
        log_id: 'l1',
        user_id: 'u1',
        operation_type: 'CREATE',
        resource_type: 'portfolio',
        resource_id: 'p1',
        details: { name: 'Test' },
        ip_address: '127.0.0.1',
        user_agent: 'test',
        created_at: new Date('2026-01-01T00:00:00Z'),
      };
      const hash1 = AuditLogIntegrityService.computeLogHash(logData);
      const hash2 = AuditLogIntegrityService.computeLogHash(logData);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('recordIntegrity', () => {
    it('should create first record', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ log_id: 'l1', log_hash: 'hash', previous_hash: '0'.repeat(64), chain_root: 'hash', chain_index: 0 });
      await AuditLogIntegrityService.recordIntegrity('l1', {
        user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio', resource_id: 'p1',
        details: {}, ip_address: '127.0.0.1', user_agent: 'test', created_at: new Date(),
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should chain to previous record', async () => {
      repo.findOne.mockResolvedValue({ log_id: 'l0', log_hash: 'prevhash', chain_root: 'root', chain_index: 0 });
      repo.create.mockReturnValue({ log_id: 'l1', log_hash: 'hash', previous_hash: 'prevhash', chain_root: 'root', chain_index: 1 });
      await AuditLogIntegrityService.recordIntegrity('l1', {
        user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio', resource_id: 'p1',
        details: {}, ip_address: '127.0.0.1', user_agent: 'test', created_at: new Date(),
      });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('verifyChain', () => {
    it('should return valid for empty chain', async () => {
      repo.find.mockResolvedValue([]);
      const result = await AuditLogIntegrityService.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.total).toBe(0);
    });

    it('should detect missing root', async () => {
      repo.find.mockResolvedValue([{ log_id: 'l1', log_hash: 'h1', previous_hash: 'h0', chain_root: 'root', chain_index: 1 }]);
      const result = await AuditLogIntegrityService.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken[0].reason).toContain('root missing');
    });

    it('should detect broken hash chain', async () => {
      repo.find.mockResolvedValue([
        { log_id: 'l0', log_hash: 'h0', previous_hash: '0'.repeat(64), chain_root: 'root', chain_index: 0 },
        { log_id: 'l1', log_hash: 'h1', previous_hash: 'wrong', chain_root: 'root', chain_index: 1 },
      ]);
      const result = await AuditLogIntegrityService.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken[0].reason).toContain('Hash chain broken');
    });

    it('should detect index discontinuity', async () => {
      repo.find.mockResolvedValue([
        { log_id: 'l0', log_hash: 'h0', previous_hash: '0'.repeat(64), chain_root: 'root', chain_index: 0 },
        { log_id: 'l1', log_hash: 'h1', previous_hash: 'h0', chain_root: 'root', chain_index: 2 },
      ]);
      const result = await AuditLogIntegrityService.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken[0].reason).toContain('discontinuity');
    });

    it('should return valid for intact chain', async () => {
      repo.find.mockResolvedValue([
        { log_id: 'l0', log_hash: 'h0', previous_hash: '0'.repeat(64), chain_root: 'root', chain_index: 0 },
        { log_id: 'l1', log_hash: 'h1', previous_hash: 'h0', chain_root: 'root', chain_index: 1 },
      ]);
      const result = await AuditLogIntegrityService.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.broken).toHaveLength(0);
    });
  });

  describe('verifyLog', () => {
    it('should return NOT_FOUND when record missing', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await AuditLogIntegrityService.verifyLog('l1', {
        user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio', resource_id: 'p1',
        details: {}, ip_address: '127.0.0.1', user_agent: 'test', created_at: new Date(),
      });
      expect(result.valid).toBe(false);
      expect(result.actualHash).toBe('NOT_FOUND');
    });

    it('should verify matching hash', async () => {
      const logData = {
        log_id: 'l1', user_id: 'u1', operation_type: 'CREATE', resource_type: 'portfolio', resource_id: 'p1',
        details: {}, ip_address: '127.0.0.1', user_agent: 'test', created_at: new Date('2026-01-01T00:00:00Z'),
      };
      const expectedHash = AuditLogIntegrityService.computeLogHash(logData);
      repo.findOne.mockResolvedValue({ log_id: 'l1', log_hash: expectedHash });
      const result = await AuditLogIntegrityService.verifyLog('l1', logData);
      expect(result.valid).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      repo.find.mockResolvedValue([]);
      const result = await AuditLogIntegrityService.getStats();
      expect(result.total_records).toBe(0);
      expect(result.chain_valid).toBe(true);
    });
  });
});
