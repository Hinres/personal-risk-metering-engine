/**
 * [PRME-v1.3.2-V2-01] 用户反馈路由
 * 文件: feedback.routes.ts
 * 需求描述: POST /feedbacks（提交）、GET /feedbacks/mine（我的）、
 *           GET /admin/feedbacks（管理端）、PATCH /admin/feedbacks/:id/reply（回复）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §1.3
 * 日期: 2026-09-19
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import {
  submitFeedback,
  listMyFeedbacks,
  adminListFeedbacks,
  replyFeedback,
} from '../controllers/feedback.controller';

const router = Router();

// 用户侧：提交 + 我的列表（需登录 + 风险揭示确认）
router.post('/feedbacks', authMiddleware, riskAcknowledgmentMiddleware, submitFeedback);
router.get('/feedbacks/mine', authMiddleware, riskAcknowledgmentMiddleware, listMyFeedbacks);

// 管理端：列表筛选 + 回复/关闭
router.get('/admin/feedbacks', authMiddleware, adminMiddleware, adminListFeedbacks);
router.patch('/admin/feedbacks/:id/reply', authMiddleware, adminMiddleware, replyFeedback);

export default router;
