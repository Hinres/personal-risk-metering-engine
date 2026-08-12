/**
 * [PRME-RM-001] riskMonitoring.job 单元测试
 * 测试范围: scheduleRiskMonitoring 调度与回调逻辑
 * 最后更新: 2026-06-25
 */
import cron from 'node-cron';
import { scheduleRiskMonitoring } from '../../src/jobs/riskMonitoring.job';
import { MonitorService } from '../../src/services/monitor.service';

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

jest.mock('../../src/services/monitor.service', () => ({
  MonitorService: {
    checkAllMonitors: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('PRME-RM-001: Risk Monitoring Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleRiskMonitoring()', () => {
    it('should return a cron task handle with stop method', () => {
      const task = scheduleRiskMonitoring();

      expect(task).toBeDefined();
      expect(typeof task.stop).toBe('function');
    });

    it('should schedule with 30-second interval expression', () => {
      scheduleRiskMonitoring();

      const mockedSchedule = cron.schedule as jest.Mock;
      expect(mockedSchedule).toHaveBeenCalledTimes(1);
      const callArgs = mockedSchedule.mock.calls[0];
      expect(callArgs[0]).toBe('*/30 * * * * *');
    });

    it('should call MonitorService.checkAllMonitors when callback fires', async () => {
      const task = scheduleRiskMonitoring() as any;
      const callback = task._callback;

      expect(callback).toBeDefined();
      expect(typeof callback).toBe('function');

      await callback();

      expect(MonitorService.checkAllMonitors).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully without throwing', async () => {
      (MonitorService.checkAllMonitors as jest.Mock).mockRejectedValue(new Error('Monitor check failed'));

      const task = scheduleRiskMonitoring() as any;
      const callback = task._callback;

      await expect(callback()).resolves.not.toThrow();
    });
  });
});
