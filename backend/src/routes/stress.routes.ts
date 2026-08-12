/**
 * [PRME-INFRA-006] 基础设施
 * 文件: stress.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getScenarios, runStressTest, getStressHistory } from '../controllers/stress.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/scenarios', authMiddleware, riskAcknowledgmentMiddleware, getScenarios);
router.post('/test', authMiddleware, riskAcknowledgmentMiddleware, runStressTest);
router.post('/custom', authMiddleware, riskAcknowledgmentMiddleware, runStressTest);
router.get('/history', authMiddleware, riskAcknowledgmentMiddleware, getStressHistory);

// 别名路由：支持 /stress-test 直接访问（映射到 /stress 的默认场景）
router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getScenarios);
router.post('/', authMiddleware, riskAcknowledgmentMiddleware, runStressTest);

// SIT-STRESS-003 兼容路由：QA 测试脚本使用 /stress/run 路径
router.post('/run', authMiddleware, riskAcknowledgmentMiddleware, runStressTest);

export default router;
