/**
 * [PRME-INFRA-006] 基础设施
 * 文件: auth.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { register, login, wechatLogin, getProfile, refresh } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/wechat', authLimiter, wechatLogin);
router.get('/profile', authMiddleware, getProfile);

export default router;
