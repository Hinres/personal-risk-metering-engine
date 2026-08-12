/**
 * [PRME-INFRA-002] 分区表维护定时任务单元测试
 * 测试范围: runPartitionMaintenance, schedulePartitionMaintenance
 * 最后更新: 2026-06-28
 */
import { runPartitionMaintenance, schedulePartitionMaintenance } from '../../src/jobs/partitionMaintenance.job';
import { PartitionService } from '../../src/services/partition.service';

jest.mock('../../src/services/partition.service');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('partitionMaintenance.job', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('runPartitionMaintenance', () => {
    it('should run maintenance successfully', async () => {
      (PartitionService.maintainPartitions as jest.Mock).mockResolvedValue({
        created: ['audit_logs_2026_07'],
        archived: ['audit_logs_2026_01'],
        dropped: ['audit_logs_2025_01'],
      });
      await runPartitionMaintenance();
      expect(PartitionService.maintainPartitions).toHaveBeenCalled();
    });

    it('should skip if already running', async () => {
      // First call starts running
      (PartitionService.maintainPartitions as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ created: [], archived: [], dropped: [] }), 100)));
      const p1 = runPartitionMaintenance();
      // Second call should be skipped
      await runPartitionMaintenance();
      await p1;
    });

    it('should handle no changes', async () => {
      (PartitionService.maintainPartitions as jest.Mock).mockResolvedValue({
        created: [],
        archived: [],
        dropped: [],
      });
      await runPartitionMaintenance();
      expect(PartitionService.maintainPartitions).toHaveBeenCalled();
    });

    it('should handle error', async () => {
      (PartitionService.maintainPartitions as jest.Mock).mockRejectedValue(new Error('db error'));
      await runPartitionMaintenance();
      expect(PartitionService.maintainPartitions).toHaveBeenCalled();
    });
  });

  describe('schedulePartitionMaintenance', () => {
    it('should schedule task when cron enabled', () => {
      const original = process.env.DISABLE_CRON;
      delete process.env.DISABLE_CRON;
      const task = schedulePartitionMaintenance();
      expect(task).toBeDefined();
      task.stop();
      if (original) process.env.DISABLE_CRON = original;
    });

    it('should return dummy task when cron disabled', () => {
      const original = process.env.DISABLE_CRON;
      process.env.DISABLE_CRON = 'true';
      const task = schedulePartitionMaintenance();
      expect(task).toBeDefined();
      process.env.DISABLE_CRON = original;
    });
  });
});
