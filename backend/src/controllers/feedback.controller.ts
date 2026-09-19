/**
 * [PRME-v1.3.2-V2-01] 用户反馈控制器
 * 文件: feedback.controller.ts
 * 需求描述: 反馈提交/我的列表/管理端列表/回复（薄控制器）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §1.4
 * 日期: 2026-09-19
 */
import { Request, Response } from 'express';
import { FeedbackService } from '../services/feedback.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const submitFeedback = async (req: any, res: Response) => {
  try {
    const result = await FeedbackService.create(req.user.user_id, req.body);
    return successResponse(res, result, 'Feedback submitted', 201);
  } catch (error: any) {
    return errorResponse(res, error.message, error.statusCode || 400);
  }
};

export const listMyFeedbacks = async (req: any, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const result = await FeedbackService.listMine(req.user.user_id, page, pageSize);
    return successResponse(res, result);
  } catch (error: any) {
    logger.error('List my feedbacks failed', { error: error.message });
    return errorResponse(res, 'Failed to list feedbacks', 500);
  }
};

export const adminListFeedbacks = async (req: any, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const result = await FeedbackService.adminList({
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      page,
      pageSize,
    });
    return successResponse(res, result);
  } catch (error: any) {
    logger.error('Admin list feedbacks failed', { error: error.message });
    return errorResponse(res, 'Failed to list feedbacks', 500);
  }
};

export const replyFeedback = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return errorResponse(res, 'Feedback ID is required', 400);
    }
    const { admin_reply, status } = req.body || {};
    const result = await FeedbackService.reply(id, req.user.user_id, admin_reply, status);
    return successResponse(res, result, 'Feedback updated');
  } catch (error: any) {
    return errorResponse(res, error.message, error.statusCode || 400);
  }
};
