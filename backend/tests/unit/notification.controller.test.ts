/**
 * [PRME-RM-002] notification.controller 单元测试
 * 测试范围: getNotifications, markAsRead, getUnreadCount, testNotification
 * 最后更新: 2026-06-24
 */
import * as notificationController from '../../src/controllers/notification.controller';
import { NotificationService } from '../../src/services/notification.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

jest.mock('../../src/services/notification.service');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-agent'),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('notification.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should get paginated notifications with default params', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      const notifications = [{ id: 'n1', message: 'Risk alert' }, { id: 'n2', message: 'Limit breached' }];
      (NotificationService.getNotificationHistory as jest.Mock).mockResolvedValue(notifications);

      await notificationController.getNotifications(req as any, res);

      expect(NotificationService.getNotificationHistory).toHaveBeenCalledWith('u1', 20);
      expect(paginatedResponse).toHaveBeenCalledWith(res, notifications, 2, 1, 20);
    });

    it('should get paginated notifications with custom page and limit', async () => {
      const req = mockReq({}, {}, { page: '2', limit: '10' });
      const res = mockRes();
      const notifications = [{ id: 'n3' }];
      (NotificationService.getNotificationHistory as jest.Mock).mockResolvedValue(notifications);

      await notificationController.getNotifications(req as any, res);

      expect(NotificationService.getNotificationHistory).toHaveBeenCalledWith('u1', 10);
      expect(paginatedResponse).toHaveBeenCalledWith(res, notifications, 1, 2, 10);
    });

    it('should clamp limit to max 100', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '200' });
      const res = mockRes();
      (NotificationService.getNotificationHistory as jest.Mock).mockResolvedValue([]);

      await notificationController.getNotifications(req as any, res);

      expect(NotificationService.getNotificationHistory).toHaveBeenCalledWith('u1', 100);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 100);
    });

    it('should clamp limit to min 1 (zero treated as default 20)', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '0' });
      const res = mockRes();
      (NotificationService.getNotificationHistory as jest.Mock).mockResolvedValue([]);

      await notificationController.getNotifications(req as any, res);

      expect(NotificationService.getNotificationHistory).toHaveBeenCalledWith('u1', 20);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 20);
    });

    it('should handle invalid page gracefully', async () => {
      const req = mockReq({}, {}, { page: 'abc', limit: '10' });
      const res = mockRes();
      (NotificationService.getNotificationHistory as jest.Mock).mockResolvedValue([]);

      await notificationController.getNotifications(req as any, res);

      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should handle error fetching notifications', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (NotificationService.getNotificationHistory as jest.Mock).mockRejectedValue(new Error('DB error'));

      await notificationController.getNotifications(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const req = mockReq({}, { id: 'n1' });
      const res = mockRes();
      (NotificationService.markAsRead as jest.Mock).mockResolvedValue(true);

      await notificationController.markAsRead(req as any, res);

      expect(NotificationService.markAsRead).toHaveBeenCalledWith('n1', 'u1');
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Notification marked as read');
    });

    it('should return 404 when notification not found', async () => {
      const req = mockReq({}, { id: 'n1' });
      const res = mockRes();
      (NotificationService.markAsRead as jest.Mock).mockResolvedValue(false);

      await notificationController.markAsRead(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Notification not found', 404);
    });

    it('should handle error marking as read', async () => {
      const req = mockReq({}, { id: 'n1' });
      const res = mockRes();
      (NotificationService.markAsRead as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await notificationController.markAsRead(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'Update failed', 500);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread count', async () => {
      const req = mockReq();
      const res = mockRes();
      (NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(5);

      await notificationController.getUnreadCount(req as any, res);

      expect(NotificationService.getUnreadCount).toHaveBeenCalledWith('u1');
      expect(successResponse).toHaveBeenCalledWith(res, { unread_count: 5 });
    });

    it('should get zero unread count', async () => {
      const req = mockReq();
      const res = mockRes();
      (NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(0);

      await notificationController.getUnreadCount(req as any, res);

      expect(successResponse).toHaveBeenCalledWith(res, { unread_count: 0 });
    });

    it('should handle error fetching unread count', async () => {
      const req = mockReq();
      const res = mockRes();
      (NotificationService.getUnreadCount as jest.Mock).mockRejectedValue(new Error('DB error'));

      await notificationController.getUnreadCount(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('testNotification', () => {
    it('should send test notification with defaults', async () => {
      const req = mockReq({});
      const res = mockRes();
      const results = [{ channel: 'app', success: true }];
      (NotificationService.send as jest.Mock).mockResolvedValue(results);

      await notificationController.testNotification(req as any, res);

      expect(NotificationService.send).toHaveBeenCalledWith({
        userId: 'u1',
        channels: ['app'],
        title: '测试通知',
        message: '这是一条测试通知',
        severity: 'low',
      });
      expect(successResponse).toHaveBeenCalledWith(res, { results }, 'Test notification sent');
    });

    it('should send test notification with custom params', async () => {
      const req = mockReq({
        channels: ['email', 'app'],
        title: 'Custom Title',
        message: 'Custom message',
        severity: 'high',
      });
      const res = mockRes();
      const results = [
        { channel: 'email', success: true },
        { channel: 'app', success: true },
      ];
      (NotificationService.send as jest.Mock).mockResolvedValue(results);

      await notificationController.testNotification(req as any, res);

      expect(NotificationService.send).toHaveBeenCalledWith({
        userId: 'u1',
        channels: ['email', 'app'],
        title: 'Custom Title',
        message: 'Custom message',
        severity: 'high',
      });
      expect(successResponse).toHaveBeenCalledWith(res, { results }, 'Test notification sent');
    });

    it('should handle error sending test notification', async () => {
      const req = mockReq({ channels: ['email'] });
      const res = mockRes();
      (NotificationService.send as jest.Mock).mockRejectedValue(new Error('SMTP error'));

      await notificationController.testNotification(req as any, res);

      expect(errorResponse).toHaveBeenCalledWith(res, 'SMTP error', 500);
    });
  });
});
