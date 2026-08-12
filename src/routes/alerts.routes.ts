/**
 * [PRME-RM-002] 风险预警系统
 * 文件: alerts.routes.ts
 * 需求描述: 预警规则与历史路由（设计文档路径对齐）
 * 最后更新: 2026-06-11
 */
import { Router } from 'express';
import { getMonitors, createMonitor, updateMonitor, deleteMonitor } from '../controllers/monitor.controller';
import { getNotifications, markAsRead, getUnreadCount } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

// ==================== 预警规则（映射到 monitor 功能）====================
// GET /api/v1/alerts/rules → 等价于 GET /api/v1/monitors
router.get('/rules', authMiddleware, riskAcknowledgmentMiddleware, getMonitors);
// POST /api/v1/alerts/rules → 等价于 POST /api/v1/monitors
router.post('/rules', authMiddleware, riskAcknowledgmentMiddleware, createMonitor);
// PUT /api/v1/alerts/rules/:id → 等价于 PUT /api/v1/monitors/:id
router.put('/rules/:id', authMiddleware, riskAcknowledgmentMiddleware, updateMonitor);
// DELETE /api/v1/alerts/rules/:id → 等价于 DELETE /api/v1/monitors/:id
router.delete('/rules/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteMonitor);

// ==================== 预警历史（映射到 notification 功能）====================
// GET /api/v1/alerts/history → 等价于 GET /api/v1/notifications
router.get('/history', authMiddleware, getNotifications);
// PUT /api/v1/alerts/history/:id/read → 等价于 PUT /api/v1/notifications/:id/read
router.put('/history/:id/read', authMiddleware, markAsRead);
// GET /api/v1/alerts/history/unread-count → 等价于 GET /api/v1/notifications/unread-count
router.get('/history/unread-count', authMiddleware, getUnreadCount);

export default router;
