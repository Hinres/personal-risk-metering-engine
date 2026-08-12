/**
 * [PRME-TS-002] 登录安全路由
 * 文件: loginSecurity.routes.ts
 * 需求描述: 等保二级-身份鉴别控制点优化：登录历史、活跃设备
 * 最后更新: 2026-07-07
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';
import { getLoginHistory, getActiveDevices } from '../controllers/loginSecurity.controller';

const router = Router();

router.get('/login-history', authMiddleware, riskAcknowledgmentMiddleware, getLoginHistory);
router.get('/active-devices', authMiddleware, riskAcknowledgmentMiddleware, getActiveDevices);

export default router;
