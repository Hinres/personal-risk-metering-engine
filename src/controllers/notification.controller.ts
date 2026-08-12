/**
 * [PRME-RM-002] 风险预警系统
 * 文件: notification.controller.ts
 * 需求描述: 风险预警系统功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

export const getNotifications = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const history = await NotificationService.getNotificationHistory(req.user.user_id, limitNum);
    return paginatedResponse(res, history, history.length, pageNum, limitNum);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAsRead = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const success = await NotificationService.markAsRead(id, req.user.user_id);
    if (!success) {
      return errorResponse(res, 'Notification not found', 404);
    }
    return successResponse(res, null, 'Notification marked as read');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getUnreadCount = async (req: any, res: Response) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.user_id);
    return successResponse(res, { unread_count: count });
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const testNotification = async (req: any, res: Response) => {
  try {
    const { channels = ['app'], title = '测试通知', message = '这是一条测试通知', severity = 'low' } = req.body;
    const results = await NotificationService.send({
      userId: req.user.user_id,
      channels,
      title,
      message,
      severity: severity as any,
    });
    return successResponse(res, { results }, 'Test notification sent');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
