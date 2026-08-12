/**
 * [PRME-INFRA-006] 基础设施
 * 文件: monitor.routes.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import { getDashboard, getMonitors, getMonitorById, createMonitor, updateMonitor, deleteMonitor } from '../controllers/monitor.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from '../middleware/riskAcknowledgment.middleware';

const router = Router();

router.get('/dashboard', authMiddleware, riskAcknowledgmentMiddleware, getDashboard);
router.get('/', authMiddleware, riskAcknowledgmentMiddleware, getMonitors);
router.get('/:id', authMiddleware, riskAcknowledgmentMiddleware, getMonitorById);
router.post('/', authMiddleware, riskAcknowledgmentMiddleware, createMonitor);
router.put('/:id', authMiddleware, riskAcknowledgmentMiddleware, updateMonitor);
router.delete('/:id', authMiddleware, riskAcknowledgmentMiddleware, deleteMonitor);

// T-7: 预警延迟指标查询
router.get('/latency-metrics', authMiddleware, riskAcknowledgmentMiddleware, async (req: any, res) => {
  try {
    const { hours } = req.query;
    const result = await (await import('../services/monitor.service')).MonitorService.getAlertLatencyMetrics(
      undefined,
      hours ? parseInt(hours) : 24
    );
    res.json({ code: 200, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
