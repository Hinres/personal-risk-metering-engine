/**
 * [PRME-INFRA-002] 审计与合规 — 管理员审批路由
 * 文件: adminApproval.routes.ts
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 管理员操作审批
 * 最后更新: 2026-06-14
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import {
  createRequest,
  approveRequest,
  rejectRequest,
  getList,
  getById,
} from '../controllers/adminApproval.controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.post('/', createRequest);
router.get('/', getList);
router.get('/:id', getById);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);

export default router;
