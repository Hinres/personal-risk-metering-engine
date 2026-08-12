/**
 * [PRME-VAR-002] VaR分析和报告
 * 文件: reportGeneration.job.ts
 * 需求描述: VaR分析和报告功能实现
 * 最后更新: 2026-06-09
 */
import cron, { ScheduledTask } from 'node-cron';
import { ReportService } from '../services/report.service';
import { PortfolioService } from '../services/portfolio.service';
import logger from '../utils/logger';

export function scheduleReportGeneration(): ReturnType<typeof cron.schedule> {
  // Run every Monday at 8:00 AM
  return cron.schedule('0 8 * * 1', async () => {
    logger.info('Starting weekly report generation');
    try {
      const { portfolios } = await PortfolioService.getAll('system', 1, 1000);
      for (const portfolio of portfolios) {
        try {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          await ReportService.generate(portfolio.user_id, {
            portfolio_id: portfolio.portfolio_id,
            report_type: 'risk_summary',
            report_name: `Weekly Risk Report - ${portfolio.name}`,
            period_start: weekAgo,
            period_end: now,
          });
        } catch (e: any) {
          logger.error(`Report gen failed for portfolio ${portfolio.portfolio_id}`, { error: e.message });
        }
      }
      logger.info('Weekly report generation completed');
    } catch (error: any) {
      logger.error('Report generation job failed', { error: error.message });
    }
  });
};
