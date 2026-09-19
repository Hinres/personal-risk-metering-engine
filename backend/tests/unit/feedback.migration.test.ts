/**
 * [PRME-v1.3.2-V2-01] 009 迁移与反馈控制器测试
 * 测试范围: 009 迁移 up/down 幂等、控制器 400 校验路径 + 成功路径
 * 最后更新: 2026-09-19
 */
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../../src/config/database';
import { UserFeedbackMigration1718000000009 } from '../../src/database/migrations/009-v1.3.2-user-feedback-migration';
import { submitFeedback } from '../../src/controllers/feedback.controller';
import { FeedbackService } from '../../src/services/feedback.service';
import { successResponse, errorResponse } from '../../src/utils/response';
import { UserFeedback } from '../../src/models/UserFeedback';
import { User } from '../../src/models/User';

jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('V2-01 009 迁移与控制器', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const u = userRepo.create({ username: 'test-fbctl-user', email: 'fbctl@test.com' });
    await userRepo.save(u);
    userId = u.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    await AppDataSource.getRepository(UserFeedback).clear();
    await userRepo.delete({ user_id: userId });
  });

  describe('009 迁移', () => {
    it('up 应创建 user_feedbacks 表与索引，且重复执行幂等', async () => {
      const migration = new UserFeedbackMigration1718000000009();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();

      try {
        // 幂等：连续执行两次不报错
        await migration.up(qr);
        await migration.up(qr);

        const rows: any[] = await qr.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='user_feedbacks'`
        );
        expect(rows.length).toBe(1);

        const cols: any[] = await qr.query(`PRAGMA table_info(user_feedbacks)`);
        const colNames = cols.map(c => c.name);
        for (const expected of ['feedback_id', 'user_id', 'type', 'content', 'rating', 'status', 'admin_reply', 'replied_by', 'replied_at', 'created_at', 'updated_at']) {
          expect(colNames).toContain(expected);
        }

        const idxList: any[] = await qr.query(`PRAGMA index_list('user_feedbacks')`);
        // 覆盖列校验（索引名因 synchronize/迁移两条建链可能不同，按列断言功能等价）
        const indexedCols = new Set<string>();
        for (const i of idxList) {
          const info: any[] = await qr.query(`PRAGMA index_info('${i.name}')`);
          info.forEach(c => indexedCols.add(c.name));
        }
        expect(indexedCols.has('user_id')).toBe(true);
        expect(indexedCols.has('status')).toBe(true);
      } finally {
        await qr.release();
      }
    });

    it('down 应清空数据且保留表结构', async () => {
      const migration = new UserFeedbackMigration1718000000009();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        await migration.up(qr);
        await qr.query(
          `INSERT INTO user_feedbacks (feedback_id, user_id, type, content, status) VALUES ('test-fb-001', '${userId}', 'feedback', 'down测试内容', 'new')`
        );
        await migration.down(qr);

        const rows: any[] = await qr.query(`SELECT COUNT(*) AS c FROM user_feedbacks`);
        expect(Number(rows[0].c)).toBe(0);

        const table: any[] = await qr.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='user_feedbacks'`
        );
        expect(table.length).toBe(1);
      } finally {
        await qr.release();
      }
    });
  });

  describe('feedback.controller', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const mockReq = (body: any) => ({ body, user: { user_id: userId } });

    it('400 校验路径：非法 type 走 errorResponse 400', async () => {
      const req = mockReq({ type: 'invalid', content: '这是校验路径测试内容' });
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      await submitFeedback(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('type'), 400);
    });

    it('成功路径：返回 201 + feedback_id + status=new', async () => {
      const req = mockReq({ type: 'question', content: '控制器成功路径测试问题' });
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      await submitFeedback(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ feedback_id: expect.any(String), status: 'new' }),
        'Feedback submitted',
        201
      );
    });

    it('service 层校验与控制器联通：content 过短 400', async () => {
      const req = mockReq({ type: 'feedback', content: '短' });
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      await submitFeedback(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining('5~1000'), 400);
    });
  });
});
