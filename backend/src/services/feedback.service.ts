/**
 * [PRME-v1.3.2-V2-01] 用户反馈服务
 * 文件: feedback.service.ts
 * 需求描述: 反馈提交（四类 + 频控）、我的列表、管理端列表筛选、回复状态流转
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §1.4
 * 日期: 2026-09-19
 */
import { AppDataSource } from '../config/database';
import { UserFeedback, FeedbackType, FeedbackStatus } from '../models/UserFeedback';
import { User } from '../models/User';
import logger from '../utils/logger';

const feedbackRepo = () => AppDataSource.getRepository(UserFeedback);

const VALID_TYPES: FeedbackType[] = ['feedback', 'question', 'suggestion', 'rating'];
const DAILY_LIMIT = 20;

/** 去除控制字符（防存储型 XSS 双保险，展示端默认转义） */
function sanitizeContent(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export class FeedbackService {
  /**
   * 提交反馈。校验规则（不满足抛错，由 controller 转 400/429）：
   * - type ∈ 四枚举必填；content trim 后 5~1000 字符；
   * - rating 仅 type='rating' 时必填且 ∈ 1~5，其余类型必须为空；
   * - 频控：同一用户 24h 内最多 20 条（超限 429）。
   */
  static async create(userId: string, data: any) {
    const type = String(data?.type || '').trim() as FeedbackType;
    if (!VALID_TYPES.includes(type)) {
      throw Object.assign(new Error('type 必须是 feedback / question / suggestion / rating 之一'), { statusCode: 400 });
    }

    const content = sanitizeContent(String(data?.content ?? '').trim());
    if (!content || content.length < 5 || content.length > 1000) {
      throw Object.assign(new Error('content 长度须为 5~1000 字符'), { statusCode: 400 });
    }

    const rating = data?.rating ?? null;
    if (type === 'rating') {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        throw Object.assign(new Error('rating 类型必须提供 1~5 的整数评分'), { statusCode: 400 });
      }
    } else if (rating !== null && rating !== undefined && rating !== '') {
      throw Object.assign(new Error('仅 rating 类型可携带评分，其余类型 rating 必须为空'), { statusCode: 400 });
    }

    // 频控：24h 内 20 条
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await feedbackRepo()
      .createQueryBuilder('f')
      .where('f.user_id = :userId', { userId })
      .andWhere('f.created_at >= :since', { since: since.toISOString() })
      .getCount();
    if (recentCount >= DAILY_LIMIT) {
      throw Object.assign(new Error('提交过于频繁，请稍后再试'), { statusCode: 429 });
    }

    const entity = feedbackRepo().create({
      user_id: userId,
      type,
      content,
      rating: type === 'rating' ? Number(rating) : null,
      status: 'new',
    });
    await feedbackRepo().save(entity);

    return { feedback_id: entity.feedback_id, status: entity.status };
  }

  /** 我的反馈列表（分页，含回复；不含 user_id） */
  static async listMine(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await feedbackRepo().findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      total,
      page,
      pageSize,
      items: items.map(f => this.serialize(f, false)),
    };
  }

  /** 管理端列表：支持 status / type 筛选 + 分页，含 username */
  static async adminList(filters: { status?: string; type?: string; page?: number; pageSize?: number }) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const qb = feedbackRepo()
      .createQueryBuilder('f')
      .orderBy('f.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filters.status) qb.andWhere('f.status = :status', { status: filters.status });
    if (filters.type) qb.andWhere('f.type = :type', { type: filters.type });

    const [rows, total] = await qb.getManyAndCount();
    const userRepo = AppDataSource.getRepository(User);
    const items = await Promise.all(rows.map(async f => {
      const user = await userRepo.findOne({ where: { user_id: f.user_id } });
      return { ...this.serialize(f, true), username: user?.username || null };
    }));

    return { total, page, pageSize, items };
  }

  /**
   * 管理员回复 + 状态流转：
   * - status='replied'：必须带 admin_reply，置 replied_at / replied_by；
   * - status='closed'：允许无回复直接关闭；
   * - 其余状态值非法。
   */
  static async reply(feedbackId: string, adminId: string, adminReply: string | undefined, status: FeedbackStatus) {
    const feedback = await feedbackRepo().findOne({ where: { feedback_id: feedbackId } });
    if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });

    if (status === 'replied') {
      const reply = sanitizeContent(String(adminReply ?? '').trim());
      if (!reply) throw Object.assign(new Error('回复内容不能为空'), { statusCode: 400 });
      feedback.admin_reply = reply;
      feedback.replied_by = adminId;
      feedback.replied_at = new Date();
      feedback.status = 'replied';
    } else if (status === 'closed') {
      feedback.status = 'closed';
      if (adminReply) {
        feedback.admin_reply = sanitizeContent(String(adminReply).trim());
        feedback.replied_by = adminId;
        feedback.replied_at = new Date();
      }
    } else {
      throw Object.assign(new Error('status 必须是 replied 或 closed'), { statusCode: 400 });
    }

    await feedbackRepo().save(feedback);
    logger.info('Feedback replied/closed', { feedbackId, status, adminId });
    return this.serialize(feedback, true);
  }

  private static serialize(f: UserFeedback, includeUserId: boolean) {
    const base = {
      feedback_id: f.feedback_id,
      type: f.type,
      content: f.content,
      rating: f.rating,
      status: f.status,
      admin_reply: f.admin_reply,
      replied_at: f.replied_at,
      created_at: f.created_at,
    };
    return includeUserId ? { ...base, user_id: f.user_id } : base;
  }
}
