import { cleanupExpiredExports } from '../../src/jobs/exportCleanup.job';
import { AppDataSource } from '../../src/config/database';
import { DataExportRequest } from '../../src/models/DataExportRequest';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
  }),
  __esModule: true,
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
    }),
  },
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

describe('T-28 Export File Cleanup', () => {
  const exportRepo = () => AppDataSource.getRepository(DataExportRequest);
  const exportsDir = path.resolve('/tmp', 'prme-test-exports');
  let testUserId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Seed test user (required by FK constraint)
    const userRepo = AppDataSource.getRepository('User');
    const existingUser = await userRepo.findOne({ where: { username: 'exportcleanup-test-user' } });
    if (existingUser) {
      testUserId = (existingUser as any).user_id;
    } else {
      const user = userRepo.create({ username: 'exportcleanup-test-user', email: 'cleanup@test.com' });
      const saved = await userRepo.save(user);
      testUserId = (saved as any).user_id;
    }
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  afterEach(async () => {
    // 清理测试数据
    await exportRepo().clear();
    // 清理测试文件
    const files = fs.readdirSync(exportsDir);
    for (const file of files) {
      fs.unlinkSync(path.join(exportsDir, file));
    }
  });

  describe('TC-CLEAN.1: Expired exports should be cleaned', () => {
    it('should delete expired export files and DB records', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 创建过期导出记录 + 文件
      const expiredExport = exportRepo().create({
        user_id: testUserId,
        format: 'json',
        status: 'completed',
        file_path: path.join(exportsDir, 'expired-test_export.json'),
        file_size: 100,
        expires_at: yesterday,
        generated_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      });
      await exportRepo().save(expiredExport);
      fs.writeFileSync(expiredExport.file_path!, '{"test": true}');

      // 创建未过期导出记录 + 文件
      const activeExport = exportRepo().create({
        user_id: testUserId,
        format: 'json',
        status: 'completed',
        file_path: path.join(exportsDir, 'active-test_export.json'),
        file_size: 100,
        expires_at: tomorrow,
        generated_at: new Date(),
      });
      await exportRepo().save(activeExport);
      fs.writeFileSync(activeExport.file_path!, '{"test": true}');

      // 执行清理
      const result = await cleanupExpiredExports(exportsDir);

      // 验证
      expect(result.deletedFiles).toBe(1);
      expect(result.deletedRecords).toBe(1);
      expect(result.errors).toBe(0);

      // 过期文件已删除
      expect(fs.existsSync(expiredExport.file_path!)).toBe(false);
      // 未过期文件保留
      expect(fs.existsSync(activeExport.file_path!)).toBe(true);

      // 过期记录已删除
      const expiredCheck = await exportRepo().findOne({ where: { export_id: expiredExport.export_id } });
      expect(expiredCheck).toBeNull();
      // 未过期记录保留
      const activeCheck = await exportRepo().findOne({ where: { export_id: activeExport.export_id } });
      expect(activeCheck).not.toBeNull();
    });
  });

  describe('TC-CLEAN.2: Orphaned files should be cleaned', () => {
    it('should delete files with no DB record', async () => {
      // 创建孤立文件（无DB记录）- 使用真实UUID格式
      const orphanId = '550e8400-e29b-41d4-a716-446655440000';
      const orphanFile = path.join(exportsDir, `${orphanId}_export.json`);
      fs.writeFileSync(orphanFile, '{"orphan": true}');

      // 执行清理
      const result = await cleanupExpiredExports(exportsDir);

      // 验证孤立文件已删除
      expect(fs.existsSync(orphanFile)).toBe(false);
      expect(result.deletedFiles).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TC-CLEAN.3: Pending exports should not be cleaned', () => {
    it('should not delete pending or failed exports', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 创建过期的 pending 导出（不应被清理）
      const pendingExport = exportRepo().create({
        user_id: testUserId,
        format: 'json',
        status: 'pending', // 不是 completed，不应被清理
        file_path: path.join(exportsDir, 'pending-test_export.json'),
        expires_at: yesterday,
      });
      await exportRepo().save(pendingExport);
      fs.writeFileSync(pendingExport.file_path!, '{"test": true}');

      // 执行清理
      const result = await cleanupExpiredExports(exportsDir);

      // pending 不应被清理
      expect(fs.existsSync(pendingExport.file_path!)).toBe(true);
      const pendingCheck = await exportRepo().findOne({ where: { export_id: pendingExport.export_id } });
      expect(pendingCheck).not.toBeNull();
    });
  });

  describe('TC-CLEAN.4: Non-export files should be ignored', () => {
    it('should not delete non-export files in exports directory', async () => {
      const nonExportFile = path.join(exportsDir, '.gitkeep');
      fs.writeFileSync(nonExportFile, '');

      const result = await cleanupExpiredExports(exportsDir);

      // .gitkeep 不应被删除
      expect(fs.existsSync(nonExportFile)).toBe(true);
      expect(result.errors).toBe(0);
    });
  });
});
