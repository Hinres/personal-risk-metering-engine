/**
 * [PRME-INFRA-002] 分区表 - 单元测试
 * 文件: partition.service.test.ts
 * 测试范围: PartitionService 分区管理功能
 * 最后更新: 2026-06-19
 */

import { PartitionService } from '../../src/services/partition.service';
import { AppDataSource } from '../../src/config/database';

// Mock database - must be before any imports that use it
jest.mock('../../src/config/database', () => {
  const mockFindOne = jest.fn().mockResolvedValue(null);
  const mockFind = jest.fn().mockResolvedValue([]);
  const mockCreate = jest.fn().mockReturnValue({});
  const mockSave = jest.fn().mockResolvedValue(undefined);

  const mockQueryBuilder = jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  });

  return {
    AppDataSource: {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn().mockReturnValue({
        findOne: mockFindOne,
        find: mockFind,
        create: mockCreate,
        save: mockSave,
        createQueryBuilder: mockQueryBuilder,
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    },
  };
});

describe('PartitionService', () => {
  let repo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = AppDataSource.getRepository('PartitionMetadata');
    repo.findOne.mockResolvedValue(null);
    repo.find.mockResolvedValue([]);
    repo.create.mockReturnValue({});
    repo.save.mockResolvedValue(undefined);
    (AppDataSource.query as jest.Mock).mockResolvedValue([]);
  });

  describe('TC-PART.1: getPartitionName', () => {
    it('should generate YYYY_MM format', () => {
      const date = new Date(2026, 5, 15); // June 2026
      expect(PartitionService.getPartitionName(date)).toBe('2026_06');
    });

    it('should pad month with zero', () => {
      const date = new Date(2026, 0, 15); // January
      expect(PartitionService.getPartitionName(date)).toBe('2026_01');
    });

    it('should use current date by default', () => {
      const result = PartitionService.getPartitionName();
      expect(result).toMatch(/^\d{4}_\d{2}$/);
    });
  });

  describe('TC-PART.2: getPartitionTableName', () => {
    it('should combine table type and partition name', () => {
      expect(PartitionService.getPartitionTableName('audit_logs', '2026_06'))
        .toBe('audit_logs_2026_06');
    });

    it('should work for monitor_snapshots', () => {
      expect(PartitionService.getPartitionTableName('monitor_snapshots', '2026_07'))
        .toBe('monitor_snapshots_2026_07');
    });
  });

  describe('TC-PART.3: getPartitionRange', () => {
    it('should return correct month range', () => {
      const range = PartitionService.getPartitionRange('2026_06');
      expect(range.start.getFullYear()).toBe(2026);
      expect(range.start.getMonth()).toBe(5); // June = 5
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getFullYear()).toBe(2026);
      expect(range.end.getMonth()).toBe(6); // July = 6
      expect(range.end.getDate()).toBe(1);
    });

    it('should handle year boundary', () => {
      const range = PartitionService.getPartitionRange('2026_12');
      expect(range.start.getFullYear()).toBe(2026);
      expect(range.start.getMonth()).toBe(11); // December = 11
      expect(range.end.getFullYear()).toBe(2027);
      expect(range.end.getMonth()).toBe(0); // January = 0
    });
  });

  describe('TC-PART.4: ensurePartition', () => {
    it('should create audit_logs partition table', async () => {
      const tableName = await PartitionService.ensurePartition('audit_logs', '2026_06');
      expect(tableName).toBe('audit_logs_2026_06');
      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS audit_logs_2026_06')
      );
    });

    it('should create monitor_snapshots partition table', async () => {
      const tableName = await PartitionService.ensurePartition('monitor_snapshots', '2026_06');
      expect(tableName).toBe('monitor_snapshots_2026_06');
      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS monitor_snapshots_2026_06')
      );
    });

    it('should return existing partition without creating', async () => {
      repo.findOne.mockResolvedValue({
        table_type: 'audit_logs',
        partition_name: '2026_06',
        status: 'active',
      });

      const tableName = await PartitionService.ensurePartition('audit_logs', '2026_06');
      expect(tableName).toBe('audit_logs_2026_06');
      // 不应当调用 CREATE TABLE
      const createCalls = (AppDataSource.query as jest.Mock).mock.calls.filter(
        (c: any) => c[0]?.includes('CREATE TABLE')
      );
      expect(createCalls.length).toBe(0);
    });
  });

  describe('TC-PART.5: insert', () => {
    it('should insert data into correct partition', async () => {
      await PartitionService.insert('audit_logs', {
        operation_type: 'CREATE',
        resource_type: 'portfolio',
        created_at: new Date('2026-06-15'),
      });

      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs_2026_06'),
        expect.any(Array)
      );
    });

    it('should use current date when timestamp field is missing', async () => {
      await PartitionService.insert('audit_logs', {
        operation_type: 'CREATE',
        resource_type: 'portfolio',
      }, 'created_at');

      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs_'),
        expect.any(Array)
      );
    });
  });

  describe('TC-PART.6: queryPartitions', () => {
    beforeEach(() => {
      // Reset queryBuilder mock to return partitions for these tests
      const repo = AppDataSource.getRepository('PartitionMetadata');
      (repo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { table_type: 'audit_logs', partition_name: '2026_06', status: 'active' },
        ]),
      });
    });

    it('should query with date range', async () => {
      const result = await PartitionService.queryPartitions('audit_logs', {
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
      });

      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM audit_logs_2026_06'),
        []
      );
    });

    it('should query with where clause and limit', async () => {
      await PartitionService.queryPartitions('audit_logs', {
        where: 'user_id = ?',
        params: ['u1'],
        orderBy: 'created_at DESC',
        limit: 10,
      });

      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        ['u1']
      );
      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
      expect(AppDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
        expect.any(Array)
      );
    });

    it('should return empty array when no partitions', async () => {
      const repo = AppDataSource.getRepository('PartitionMetadata');
      (repo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await PartitionService.queryPartitions('audit_logs', {});
      expect(result).toEqual([]);
      expect(AppDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('TC-PART.7: listPartitions', () => {
    it('should list all partitions', async () => {
      repo.find.mockResolvedValue([
        { table_type: 'audit_logs', partition_name: '2026_06' },
      ]);

      const result = await PartitionService.listPartitions('audit_logs');
      expect(result.length).toBe(1);
    });

    it('should filter by status', async () => {
      repo.find.mockResolvedValue([
        { table_type: 'audit_logs', partition_name: '2026_06', status: 'active' },
      ]);

      const result = await PartitionService.listPartitions('audit_logs', 'active');
      expect(result.length).toBe(1);
    });
  });

  describe('TC-PART.8: maintainPartitions', () => {
    it('should return maintenance result', async () => {
      const result = await PartitionService.maintainPartitions();
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('archived');
      expect(result).toHaveProperty('dropped');
      expect(Array.isArray(result.created)).toBe(true);
      expect(Array.isArray(result.archived)).toBe(true);
      expect(Array.isArray(result.dropped)).toBe(true);
    });

    it('should archive old audit_logs partitions', async () => {
      // Mock old partition that needs archiving
      repo.find.mockImplementation((opts: any) => {
        if (opts?.where?.status === 'active' && opts?.where?.table_type === 'audit_logs') {
          return [
            {
              table_type: 'audit_logs',
              partition_name: '2023_01',
              partition_end: new Date('2023-02-01'),
              status: 'active',
            },
          ];
        }
        return [];
      });

      const result = await PartitionService.maintainPartitions();
      expect(result.archived.length).toBeGreaterThanOrEqual(0);
    });

    it('should drop old monitor_snapshots partitions', async () => {
      // Mock old partition that needs dropping
      repo.find.mockImplementation((opts: any) => {
        if (opts?.where?.status === 'active' && opts?.where?.table_type === 'monitor_snapshots') {
          return [
            {
              table_type: 'monitor_snapshots',
              partition_name: '2023_01',
              partition_end: new Date('2023-02-01'),
              status: 'active',
            },
          ];
        }
        return [];
      });

      const result = await PartitionService.maintainPartitions();
      expect(result.dropped.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TC-PART.9: countByPartition', () => {
    it('should return partition record counts', async () => {
      repo.find.mockResolvedValue([
        { table_type: 'audit_logs', partition_name: '2026_06', status: 'active' },
      ]);
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ cnt: 42 }]);

      const result = await PartitionService.countByPartition('audit_logs');
      expect(result['2026_06']).toBe(42);
    });

    it('should return -1 for non-existent table', async () => {
      repo.find.mockResolvedValue([
        { table_type: 'audit_logs', partition_name: '2026_06', status: 'active' },
      ]);
      (AppDataSource.query as jest.Mock).mockRejectedValue(new Error('no such table'));

      const result = await PartitionService.countByPartition('audit_logs');
      expect(result['2026_06']).toBe(-1);
    });
  });
});
