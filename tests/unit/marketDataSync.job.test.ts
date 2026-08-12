/**
 * [PRME-INFRA-004] marketDataSync.job 单元测试
 * 测试范围: scheduleMarketDataSync 调度与回调逻辑
 * 最后更新: 2026-06-25
 */
import cron from 'node-cron';
import { scheduleMarketDataSync } from '../../src/jobs/marketDataSync.job';
import { MarketDataService } from '../../src/services/marketData.service';

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

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getTrackedSymbols: jest.fn().mockResolvedValue(['000001.SH', 'AAPL']),
    syncFromTushare: jest.fn().mockResolvedValue({ synced: 2, failed: 0 }),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('PRME-INFRA-004: Market Data Sync Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleMarketDataSync()', () => {
    it('should return a cron task handle', () => {
      const task = scheduleMarketDataSync();

      expect(task).toBeDefined();
      expect(typeof task.stop).toBe('function');
    });

    it('should schedule at 09:30 daily', () => {
      scheduleMarketDataSync();

      const mockedSchedule = cron.schedule as jest.Mock;
      expect(mockedSchedule).toHaveBeenCalledTimes(1);
      const callArgs = mockedSchedule.mock.calls[0];
      expect(callArgs[0]).toBe('30 9 * * *');
    });

    it('should sync tracked symbols when callback fires', async () => {
      const task = scheduleMarketDataSync() as any;
      const callback = task._callback;

      await callback();

      expect(MarketDataService.getTrackedSymbols).toHaveBeenCalledTimes(1);
      expect(MarketDataService.syncFromTushare).toHaveBeenCalledTimes(1);
      expect(MarketDataService.syncFromTushare).toHaveBeenCalledWith(['000001.SH', 'AAPL']);
    });

    it('should skip sync when no tracked symbols', async () => {
      (MarketDataService.getTrackedSymbols as jest.Mock).mockResolvedValue([]);

      const task = scheduleMarketDataSync() as any;
      const callback = task._callback;

      await callback();

      expect(MarketDataService.getTrackedSymbols).toHaveBeenCalledTimes(1);
      expect(MarketDataService.syncFromTushare).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      (MarketDataService.syncFromTushare as jest.Mock).mockRejectedValue(new Error('Tushare API error'));

      const task = scheduleMarketDataSync() as any;
      const callback = task._callback;

      await expect(callback()).resolves.not.toThrow();
    });
  });
});
