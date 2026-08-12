/**
 * [PRME-INFRA-006] 基础设施
 * 文件: notification.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getNotifications, markAsRead, getUnreadCount, testNotification } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getNotifications);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.put('/:id/read', authMiddleware, markAsRead);
router.post('/test', authMiddleware, testNotification);

export default router;
