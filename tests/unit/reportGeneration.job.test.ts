/**
 * [PRME-VAR-002] reportGeneration.job 单元测试
 * 测试范围: scheduleReportGeneration 调度与回调逻辑
 * 最后更新: 2026-06-25
 */
import cron from 'node-cron';
import { scheduleReportGeneration } from '../../src/jobs/reportGeneration.job';
import { ReportService } from '../../src/services/report.service';
import { PortfolioService } from '../../src/services/portfolio.service';

jest.mock('node-cron', () => ({
  schedule: jest.fn((expression: string, callback: Function) => {
    const task = {
      stop: jest.fn(),
      start: jest.fn(),
      getStatus: jest.fn().mockReturnValue('scheduled'),
      _expression: expression,
      _callback: callback,
    };
    return task;
  }),
}));

jest.mock('../../src/services/report.service', () => ({
  ReportService: {
    generate: jest.fn().mockResolvedValue({ report_id: 'r1' }),
    closeBrowser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/portfolio.service', () => ({
  PortfolioService: {
    getAll: jest.fn().mockResolvedValue({
      portfolios: [
        { portfolio_id: 'p1', name: 'Portfolio A', user_id: 'u1' },
        { portfolio_id: 'p2', name: 'Portfolio B', user_id: 'u2' },
      ],
    }),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('PRME-VAR-002: Report Generation Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleReportGeneration()', () => {
    it('should return a cron task handle', () => {
      const task = scheduleReportGeneration();

      expect(task).toBeDefined();
      expect(typeof task.stop).toBe('function');
    });

    it('should schedule on Monday at 08:00', () => {
      scheduleReportGeneration();

      const mockedSchedule = cron.schedule as jest.Mock;
      expect(mockedSchedule).toHaveBeenCalledTimes(1);
      const callArgs = mockedSchedule.mock.calls[0];
      expect(callArgs[0]).toBe('0 8 * * 1');
    });

    it('should generate reports for all portfolios', async () => {
      const task = scheduleReportGeneration() as any;
      const callback = task._callback;

      await callback();

      expect(PortfolioService.getAll).toHaveBeenCalledWith('system', 1, 1000);
      expect(ReportService.generate).toHaveBeenCalledTimes(2);
      expect(ReportService.generate).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          portfolio_id: 'p1',
          report_type: 'risk_summary',
        })
      );
    });

    it('should handle portfolio fetch errors gracefully', async () => {
      (PortfolioService.getAll as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      const task = scheduleReportGeneration() as any;
      const callback = task._callback;

      await expect(callback()).resolves.not.toThrow();
    });

    it('should handle individual report generation errors without stopping', async () => {
      (PortfolioService.getAll as jest.Mock).mockResolvedValue({
        portfolios: [
          { portfolio_id: 'p1', name: 'Portfolio A', user_id: 'u1' },
          { portfolio_id: 'p2', name: 'Portfolio B', user_id: 'u2' },
        ],
      });

      (ReportService.generate as jest.Mock)
        .mockRejectedValueOnce(new Error('PDF generation failed'))
        .mockResolvedValueOnce({ report_id: 'r2' });

      const task = scheduleReportGeneration() as any;
      const callback = task._callback;

      await callback();

      expect(ReportService.generate).toHaveBeenCalledTimes(2);
    });
  });
});
