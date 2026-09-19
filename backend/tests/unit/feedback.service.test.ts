/**
 * [PRME-v1.3.2-V2-01] feedback.service 单元测试
 * 测试范围: 四类型创建、rating 校验、content 长度、频控、分页列表、回复流转、权限隔离、admin 筛选
 * 最后更新: 2026-09-19
 */
import { AppDataSource } from '../../src/config/database';
import { FeedbackService } from '../../src/services/feedback.service';
import { UserFeedback } from '../../src/models/UserFeedback';
import { User } from '../../src/models/User';

describe('FeedbackService (V2-01)', () => {
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const u = userRepo.create({ username: 'test-fb-user', email: 'fb@test.com' });
    await userRepo.save(u);
    userId = u.user_id;

    const admin = userRepo.create({ username: 'test-fb-admin', email: 'fb-admin@test.com', role: 'admin' } as any);
    await userRepo.save(admin);
    adminId = (admin as any).user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    await AppDataSource.getRepository(UserFeedback).clear();
    await userRepo.delete({ user_id: userId });
    await userRepo.delete({ user_id: adminId });
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(UserFeedback).clear();
  });

  describe('create', () => {
    it('四类型创建：feedback/question/suggestion/rating 均应成功', async () => {
      for (const type of ['feedback', 'question', 'suggestion']) {
        const r = await FeedbackService.create(userId, { type, content: '这是一条测试反馈内容' });
        expect(r.feedback_id).toBeTruthy();
        expect(r.status).toBe('new');
      }
      const r = await FeedbackService.create(userId, { type: 'rating', content: '产品体验打分', rating: 5 });
      expect(r.status).toBe('new');
    });

    it('rating 类型缺评分或越界应 400', async () => {
      await expect(
        FeedbackService.create(userId, { type: 'rating', content: '打分但没有分数' })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        FeedbackService.create(userId, { type: 'rating', content: '分数越界', rating: 6 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('非 rating 类型携带评分应 400', async () => {
      await expect(
        FeedbackService.create(userId, { type: 'feedback', content: '带了评分', rating: 4 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('content 长度 5~1000 校验（过短/过长 400，控制字符被清除）', async () => {
      await expect(
        FeedbackService.create(userId, { type: 'feedback', content: '短' })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        FeedbackService.create(userId, { type: 'feedback', content: 'x'.repeat(1001) })
      ).rejects.toMatchObject({ statusCode: 400 });
      const r = await FeedbackService.create(userId, { type: 'feedback', content: '正常内容\u0001带控制字符' });
      expect(r.feedback_id).toBeTruthy();
      const saved = await AppDataSource.getRepository(UserFeedback).findOne({ where: { feedback_id: r.feedback_id } });
      expect(saved!.content).not.toContain('\u0001');
    });

    it('非法 type 应 400', async () => {
      await expect(
        FeedbackService.create(userId, { type: 'bug_report', content: '非法类型测试内容' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('频控：24h 内第 21 条应 429', async () => {
      for (let i = 0; i < 20; i++) {
        await FeedbackService.create(userId, { type: 'feedback', content: `第${i}条频控测试内容` });
      }
      await expect(
        FeedbackService.create(userId, { type: 'feedback', content: '这一条应该触发频控' })
      ).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  describe('listMine', () => {
    it('仅返回自己的反馈（权限隔离），按时间倒序分页', async () => {
      const other = AppDataSource.getRepository(User).create({ username: 'test-fb-other', email: 'fb-other@test.com' });
      await AppDataSource.getRepository(User).save(other);
      try {
        await FeedbackService.create(userId, { type: 'feedback', content: '用户A的第一条反馈' });
        await FeedbackService.create(userId, { type: 'question', content: '用户A的第二条问题' });
        await FeedbackService.create(other.user_id, { type: 'feedback', content: '用户B的反馈内容' });

        const mine = await FeedbackService.listMine(userId, 1, 10);
        expect(mine.total).toBe(2);
        expect(mine.items.every((i: any) => !('user_id' in i))).toBe(true);
        expect(new Date(mine.items[0].created_at) >= new Date(mine.items[1].created_at)).toBe(true);
      } finally {
        await AppDataSource.getRepository(UserFeedback).delete({ user_id: other.user_id });
        await AppDataSource.getRepository(User).delete({ user_id: other.user_id });
      }
    });
  });

  describe('adminList + reply', () => {
    it('admin 列表支持 status/type 筛选，含 username', async () => {
      await FeedbackService.create(userId, { type: 'question', content: '筛选测试问题一' });
      await FeedbackService.create(userId, { type: 'rating', content: '筛选测试评分', rating: 3 });

      const byType = await FeedbackService.adminList({ type: 'question' });
      expect(byType.total).toBe(1);
      expect(byType.items[0].username).toBe('test-fb-user');

      const byStatus = await FeedbackService.adminList({ status: 'new' });
      expect(byStatus.total).toBe(2);
    });

    it('回复后状态 replied 且回填 replied_at/replied_by；无内容回复 400', async () => {
      const r = await FeedbackService.create(userId, { type: 'question', content: '回复流转测试问题' });
      const replied = await FeedbackService.reply(r.feedback_id, adminId, '这是管理员回复', 'replied');
      expect(replied.status).toBe('replied');
      expect(replied.admin_reply).toBe('这是管理员回复');
      expect(replied.replied_at).toBeTruthy();

      await expect(
        FeedbackService.reply(r.feedback_id, adminId, '', 'replied')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('closed 允许无回复直接关闭；非法 status 400；不存在 404', async () => {
      const r = await FeedbackService.create(userId, { type: 'feedback', content: '直接关闭测试反馈' });
      const closed = await FeedbackService.reply(r.feedback_id, adminId, undefined, 'closed');
      expect(closed.status).toBe('closed');

      await expect(
        FeedbackService.reply(r.feedback_id, adminId, 'x', 'pending' as any)
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        FeedbackService.reply('00000000-0000-0000-0000-000000000000', adminId, 'x', 'closed')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
