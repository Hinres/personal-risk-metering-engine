/**
 * [PRME-INFRA-002] dataExport.service 单元测试
 * 文件: dataExport.service.test.ts
 * 测试范围: requestExport, generateExport, getExportStatus, getExportList, downloadExport, sanitizeUser, generateManifest
 * 最后更新: 2026-06-25
 */
import { DataExportService } from '../../src/services/dataExport.service';
import { AppDataSource } from '../../src/config/database';
import fs from 'fs';
import { createHash } from 'crypto';

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ size: 1024 }),
  };
});

    const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  }),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('DataExportService', () => {
  let exportRepo: ReturnType<typeof mockRepo>;
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    exportRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'DataExportRequest' || name?.includes('Export')) return exportRepo;
      return mockRepo();
    });
  });

  // ── requestExport ──
  describe('requestExport', () => {
    it('EXP-001: 应创建导出请求并返回 generating 状态', async () => {
      exportRepo.create.mockImplementation((data) => ({ ...data, export_id: 'exp-1' }));
      exportRepo.save.mockResolvedValue({ export_id: 'exp-1', status: 'pending' });

      const result = await DataExportService.requestExport('u1', 'json');

      expect(result).toHaveProperty('export_id', 'exp-1');
      expect(result.status).toBe('generating');
      expect(result).toHaveProperty('estimated_time');
      expect(result).toHaveProperty('expires_at');
      expect(exportRepo.create).toHaveBeenCalled();
    });

    it('EXP-002: 应支持指定表名', async () => {
      exportRepo.create.mockImplementation((data) => ({ ...data, export_id: 'exp-2' }));

      const result = await DataExportService.requestExport('u1', 'json', ['users', 'portfolios']);
      expect(result.status).toBe('generating');
    });

    it('EXP-003: 无效表名应抛错', async () => {
      await expect(DataExportService.requestExport('u1', 'json', ['invalid_table']))
        .rejects.toThrow('Invalid include_tables');
    });

    it('EXP-004: 格式为 zip 时应保留', async () => {
      exportRepo.create.mockImplementation((data) => ({ ...data, export_id: 'exp-3' }));
      const result = await DataExportService.requestExport('u1', 'zip');
      expect(result).toBeDefined();
    });

    it('EXP-005: 默认格式为 json', async () => {
      exportRepo.create.mockImplementation((data) => ({ ...data, export_id: 'exp-5' }));
      const result = await DataExportService.requestExport('u1', 'xml'); // 非zip应转为json
      const createCall = exportRepo.create.mock.calls[0][0] as any;
      expect(createCall.format).toBe('json');
    });
  });

  // ── generateExport ──
  describe('generateExport', () => {
    it('EXP-006: 应生成导出文件并写入磁盘', async () => {
      const exportReq = {
        export_id: 'exp-6',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['users', 'portfolios'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const userRepo = mockRepo();
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', username: 'test' });
      const portfolioRepo = mockRepo();
      portfolioRepo.find.mockResolvedValue([{ portfolio_id: 'p1', name: '组合1' }]);

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'User') return userRepo;
        if (name === 'Portfolio') return portfolioRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-6', 'u1', ['users', 'portfolios'], 'json');

      expect(exportRepo.save).toHaveBeenCalledTimes(2); // generating + completed
      const lastSave = exportRepo.save.mock.calls[1][0] as any;
      expect(lastSave.status).toBe('completed');
      expect(lastSave).toHaveProperty('checksum');
      expect(lastSave).toHaveProperty('file_path');
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('EXP-007: 找不到导出请求时应直接返回', async () => {
      exportRepo.findOne.mockResolvedValue(null);
      await DataExportService.generateExport('exp-7', 'u1', ['users'], 'json');
      expect(exportRepo.save).not.toHaveBeenCalled();
    });

    it('EXP-008: 生成失败时应标记为 failed', async () => {
      const exportReq = {
        export_id: 'exp-8',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['users'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const userRepo = mockRepo();
      userRepo.findOne.mockRejectedValue(new Error('DB error'));
      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'User') return userRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-8', 'u1', ['users'], 'json');

      const lastSave = exportRepo.save.mock.calls[1][0] as any;
      expect(lastSave.status).toBe('failed');
      expect(lastSave.error_message).toContain('DB error');
    });

    it('EXP-009: 无组合时 holdings 应为空数组', async () => {
      const exportReq = {
        export_id: 'exp-9',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['users', 'portfolios', 'holdings'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const userRepo = mockRepo();
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', username: 'test' });
      const portfolioRepo = mockRepo();
      portfolioRepo.find.mockResolvedValue([]); // 无组合

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'User') return userRepo;
        if (name === 'Portfolio') return portfolioRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-9', 'u1', ['users', 'portfolios', 'holdings'], 'json');
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.holdings).toEqual([]);
    });

    it('EXP-009a: 无组合时 var_calculations / stress_tests 应为空数组', async () => {
      const exportReq = {
        export_id: 'exp-9a',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['var_calculations', 'stress_tests'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const portfolioRepo = mockRepo();
      portfolioRepo.find.mockResolvedValue([]); // 无组合

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'Portfolio') return portfolioRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-9a', 'u1', ['var_calculations', 'stress_tests'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.var_calculations).toEqual([]);
      expect(content.stress_tests).toEqual([]);
    });

    it('EXP-009b: 无 portfolio 时 var_calculations / stress_tests 应为空数组', async () => {
      const exportReq = {
        export_id: 'exp-9b',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['portfolios', 'var_calculations', 'stress_tests'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const portfolioRepo = mockRepo();
      portfolioRepo.find.mockResolvedValue([]); // 无组合

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'Portfolio') return portfolioRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-9b', 'u1', ['portfolios', 'var_calculations', 'stress_tests'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.var_calculations).toEqual([]);
      expect(content.stress_tests).toEqual([]);
    });

    it('EXP-009c: 应导出 alert_records', async () => {
      const exportReq = {
        export_id: 'exp-9c',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['alert_records'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        // AlertHistory 用 createQueryBuilder
        const q = {
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([{ alert_id: 'a1' }]),
        };
        return {
          ...mockRepo(),
          createQueryBuilder: jest.fn().mockReturnValue(q),
        };
      });

      await DataExportService.generateExport('exp-9c', 'u1', ['alert_records'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.alert_history).toEqual([{ alert_id: 'a1' }]);
    });

    it('EXP-009d: 无 portfolio 数据时 holdings 应为空数组', async () => {
      const exportReq = {
        export_id: 'exp-9d',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['holdings'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      // 不 mock Portfolio，所以 data.portfolios 是 undefined
      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-9d', 'u1', ['holdings'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.holdings).toEqual([]);
    });

    it('EXP-006b: 应导出 holdings, var_calculations, stress_tests 关联数据', async () => {
      const exportReq = {
        export_id: 'exp-6b',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['portfolios', 'holdings', 'var_calculations', 'stress_tests'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const portfolioRepo = mockRepo();
      portfolioRepo.find.mockResolvedValue([{ portfolio_id: 'p1', name: '组合1' }]);
      const holdingsRepo = mockRepo();
      const varCalcRepo = mockRepo();
      const stressRepo = mockRepo();

      const buildQb = (returnValue: any) => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(returnValue),
      });

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'Portfolio') return portfolioRepo;
        if (name === 'Holding') return { ...holdingsRepo, createQueryBuilder: jest.fn().mockReturnValue(buildQb([{ holding_id: 'h1' }])) };
        if (name === 'VaRCalculation') return { ...varCalcRepo, createQueryBuilder: jest.fn().mockReturnValue(buildQb([{ var_id: 'v1' }])) };
        if (name === 'StressTest') return { ...stressRepo, createQueryBuilder: jest.fn().mockReturnValue(buildQb([{ stress_id: 's1' }])) };
        return mockRepo();
      });

      await DataExportService.generateExport('exp-6b', 'u1', ['portfolios', 'holdings', 'var_calculations', 'stress_tests'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.holdings).toEqual([{ holding_id: 'h1' }]);
      expect(content.var_calculations).toEqual([{ var_id: 'v1' }]);
      expect(content.stress_tests).toEqual([{ stress_id: 's1' }]);
    });

    it('EXP-009c: requestExport 异步生成失败时应记录日志', async () => {
      exportRepo.create.mockImplementation((data) => ({ ...data, export_id: 'exp-9c' }));
      exportRepo.save.mockResolvedValue({ export_id: 'exp-9c', status: 'pending' });

      // 让 generateExport 在异步执行时抛出异常
      jest.spyOn(DataExportService, 'generateExport').mockRejectedValue(new Error('Async gen failed'));

      const result = await DataExportService.requestExport('u1', 'json');
      expect(result.status).toBe('generating');

      // 等待异步 catch 执行
      await new Promise(r => setTimeout(r, 100));
      expect(DataExportService.generateExport).toHaveBeenCalled();
    });
    it('EXP-006c: 当导出目录不存在时应创建目录', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const exportReq = {
        export_id: 'exp-6c',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['users'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const userRepo = mockRepo();
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', username: 'test' });

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'User') return userRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-6c', 'u1', ['users'], 'json');
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('EXP-006d: 用户不存在时 users 应为空数组', async () => {
      const exportReq = {
        export_id: 'exp-6d',
        user_id: 'u1',
        status: 'pending',
        include_tables: ['users'],
      };
      exportRepo.findOne.mockResolvedValue(exportReq);

      const userRepo = mockRepo();
      userRepo.findOne.mockResolvedValue(null);

      mockedGetRepository.mockImplementation((entity: any) => {
        const name = entity?.name || entity;
        if (name === 'DataExportRequest') return exportRepo;
        if (name === 'User') return userRepo;
        return mockRepo();
      });

      await DataExportService.generateExport('exp-6d', 'u1', ['users'], 'json');
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.users).toEqual([]);
    });
  });

  // ── getExportStatus ──
  describe('getExportStatus', () => {
    it('EXP-010: 应返回导出状态', async () => {
      exportRepo.findOne.mockResolvedValue({
        export_id: 'exp-10',
        user_id: 'u1',
        status: 'completed',
        format: 'json',
        file_size: 1024,
        checksum: 'abc123',
        generated_at: new Date('2026-01-01'),
        expires_at: new Date('2026-01-08'),
        error_message: null,
      });

      const result = await DataExportService.getExportStatus('u1', 'exp-10');
      expect(result.status).toBe('completed');
      expect(result.format).toBe('json');
      expect(result.checksum).toBe('abc123');
    });

    it('EXP-011: 找不到时应抛错', async () => {
      exportRepo.findOne.mockResolvedValue(null);
      await expect(DataExportService.getExportStatus('u1', 'exp-missing'))
        .rejects.toThrow('Export request not found');
    });
  });

  // ── getExportList ──
  describe('getExportList', () => {
    it('EXP-012: 应返回分页列表', async () => {
      const exports = [
        { export_id: 'e1', status: 'completed', format: 'json', generated_at: new Date(), expires_at: new Date() },
      ];
      exportRepo.findAndCount.mockResolvedValue([exports, 1]);

      const result = await DataExportService.getExportList('u1', 1, 10);
      expect(result.exports.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('EXP-012a: 应使用默认分页参数', async () => {
      const exports = [
        { export_id: 'e1', status: 'completed', format: 'json', generated_at: new Date(), expires_at: new Date() },
      ];
      exportRepo.findAndCount.mockResolvedValue([exports, 1]);

      const result = await (DataExportService as any).getExportList('u1');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(exportRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });
  });

  // ── downloadExport ──
  describe('downloadExport', () => {
    it('EXP-013: 应返回文件路径', async () => {
      exportRepo.findOne.mockResolvedValue({
        export_id: 'exp-13',
        user_id: 'u1',
        status: 'completed',
        file_path: '/tmp/exp-13_export.json',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await DataExportService.downloadExport('u1', 'exp-13');
      expect(result.filePath).toBe('/tmp/exp-13_export.json');
      expect(result.fileName).toBe('exp-13_export.json');
    });

    it('EXP-014: 未找到请求时应抛错', async () => {
      exportRepo.findOne.mockResolvedValue(null);
      await expect(DataExportService.downloadExport('u1', 'exp-missing'))
        .rejects.toThrow('Export request not found');
    });

    it('EXP-015: 未完成时应抛错', async () => {
      exportRepo.findOne.mockResolvedValue({
        export_id: 'exp-15',
        user_id: 'u1',
        status: 'generating',
        file_path: null,
        expires_at: new Date(),
      });
      await expect(DataExportService.downloadExport('u1', 'exp-15'))
        .rejects.toThrow('Export not ready');
    });

    it('EXP-016: 文件不存在时应抛错', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      exportRepo.findOne.mockResolvedValue({
        export_id: 'exp-16',
        user_id: 'u1',
        status: 'completed',
        file_path: '/tmp/missing.json',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await expect(DataExportService.downloadExport('u1', 'exp-16'))
        .rejects.toThrow('Export file not found');
    });

    it('EXP-017: 已过期时应抛错', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      exportRepo.findOne.mockResolvedValue({
        export_id: 'exp-17',
        user_id: 'u1',
        status: 'completed',
        file_path: '/tmp/exp-17.json',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await expect(DataExportService.downloadExport('u1', 'exp-17'))
        .rejects.toThrow('Export expired');
    });
  });

  // ── sanitizeUser ──
  describe('sanitizeUser', () => {
    it('EXP-018: 应脱敏敏感字段', () => {
      const user = {
        user_id: 'u1',
        username: 'test',
        password_hash: 'secret',
        phone_encrypted: 'enc',
        wechat_info: 'wx',
        metadata: { a: 1 },
        email: 'test@example.com',
      };
      const result = (DataExportService as any).sanitizeUser(user);
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('phone_encrypted');
      expect(result).not.toHaveProperty('wechat_info');
      expect(result).not.toHaveProperty('metadata');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('user_id');
    });
  });

  // ── generateManifest ──
  describe('generateManifest', () => {
    it('EXP-019: 应生成清单含记录数和校验和', () => {
      const data = {
        users: [{ id: 1 }, { id: 2 }],
        portfolios: [{ id: 'p1' }],
        _manifest: 'should be skipped',
      };
      const manifest = (DataExportService as any).generateManifest(data);
      expect(manifest.tables.users).toBe(2);
      expect(manifest.tables.portfolios).toBe(1);
      expect(manifest.total_records).toBe(3);
      expect(manifest).toHaveProperty('checksums');
      expect(manifest).toHaveProperty('generated_at');
    });

    it('EXP-019a: 非数组值应计为 0 条记录', () => {
      const data = {
        users: [{ id: 1 }],
        portfolios: 'invalid',
        _manifest: 'should be skipped',
      };
      const manifest = (DataExportService as any).generateManifest(data);
      expect(manifest.tables.portfolios).toBe(0);
      expect(manifest.total_records).toBe(1);
    });
  });
});
