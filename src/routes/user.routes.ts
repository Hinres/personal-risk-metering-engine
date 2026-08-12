/**
 * [PRME-INFRA-006] 基础设施
 * 文件: user.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import {
  getProfile, updateProfile, updateWechatInfo, getPreferences, updatePreferences,
  getUsers, deleteUser,
  riskAcknowledgment, getRiskAcknowledgmentStatus,
  recordConsent, revokeConsent, getConsents,
  requestDataExport, getExportStatus, getExportList, downloadExport,
} from '../controllers/user.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/profile', authMiddleware, riskAcknowledgmentMiddleware, getProfile);
router.put('/profile', authMiddleware, riskAcknowledgmentMiddleware, updateProfile);
router.put('/wechat', authMiddleware, riskAcknowledgmentMiddleware, updateWechatInfo);
router.get('/preferences', authMiddleware, riskAcknowledgmentMiddleware, getPreferences);
router.put('/preferences', authMiddleware, riskAcknowledgmentMiddleware, updatePreferences);

// 首次风险提示
router.get('/risk-acknowledgment/status', authMiddleware, getRiskAcknowledgmentStatus);
router.get('/risk-acknowledgment', authMiddleware, getRiskAcknowledgmentStatus);
router.post('/risk-acknowledgment', authMiddleware, riskAcknowledgment);

// 用户同意管理
router.get('/consents', authMiddleware, getConsents);
router.post('/consents', authMiddleware, recordConsent);
router.delete('/consents/:consent_type', authMiddleware, revokeConsent);

// 数据导出（可携带权利）
router.get('/data-export', authMiddleware, getExportList);
router.post('/data-export', authMiddleware, requestDataExport);
router.get('/data-export/:export_id', authMiddleware, getExportStatus);
router.get('/data-export/:export_id/download', authMiddleware, downloadExport);

// @deprecated 兼容路由：SIT-E2E-005 路径 /users/export，计划 v1.4 移除，请使用 /users/data-export
router.get('/export', authMiddleware, getExportList);
router.post('/export', authMiddleware, requestDataExport);
router.get('/export/:export_id', authMiddleware, getExportStatus);
router.get('/export/:export_id/download', authMiddleware, downloadExport);

router.get('/', authMiddleware, adminMiddleware, getUsers);
router.delete('/:id', authMiddleware, adminMiddleware, deleteUser);

export default router;
