/**
 * [PRME-v1.3-TS-003] 视频教程
 * 文件: videoTutorial.routes.ts
 * 最后更新: 2026-08-20
 */
import { Router } from 'express';
import { getVideos, getVideoById } from '../controllers/videoTutorial.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/videos', authMiddleware, riskAcknowledgmentMiddleware, getVideos);
router.get('/videos/:id', authMiddleware, riskAcknowledgmentMiddleware, getVideoById);

export default router;
