/**
 * [PRME-INFRA-006] 基础设施
 * 文件: index.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import portfolioRoutes from './portfolio.routes';
import holdingRoutes from './holding.routes';
import varRoutes from './var.routes';
import stressRoutes from './stress.routes';
import monitorRoutes from './monitor.routes';
import toolRoutes from './tool.routes';
import helpRoutes from './help.routes';
import reportRoutes from './report.routes';
import swaggerRoutes from './swagger.routes';
import systemRoutes from './system.routes';
import valuationRoutes from './valuation.routes';
import optimizationRoutes from './optimization.routes';
import notificationRoutes from './notification.routes';
import marketRoutes from './market.routes';
import alertsRoutes from './alerts.routes';
import adminApprovalRoutes from './adminApproval.routes';
import anonymizationRoutes from './anonymization.routes';
import auditRoutes from './audit.routes';

import marketAlertRoutes from './marketAlert.routes';
import loginSecurityRoutes from './loginSecurity.routes';
import auditIntegrityRoutes from './auditIntegrity.routes';
import databaseBackupRoutes from './databaseBackup.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/auth', loginSecurityRoutes);
router.use('/users', userRoutes);
router.use('/portfolios', portfolioRoutes);
router.use('/holdings', holdingRoutes);
router.use('/var', varRoutes);
router.use('/stress', stressRoutes);
router.use('/stress-test', stressRoutes); // 别名路由
router.use('/monitors', monitorRoutes);
router.use('/market', marketRoutes);
router.use('/market-alerts', marketAlertRoutes);
router.use('/alerts', alertsRoutes);
router.use('/tools', toolRoutes);
router.use('/help', helpRoutes);
router.use('/reports', reportRoutes);
router.use('/system', systemRoutes);
router.use('/valuation', valuationRoutes);
router.use('/optimization', optimizationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin-approvals', adminApprovalRoutes);
router.use('/anonymization', anonymizationRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/audit-logs', auditIntegrityRoutes);
router.use('/system', databaseBackupRoutes);
router.use('/', swaggerRoutes);

export default router;
