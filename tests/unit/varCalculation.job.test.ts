/**
 * [PRME-PA-001] varCalculation.job 单元测试
 * 测试范围: acquireLock, releaseLock, scheduleVaRCalculation
 * 最后更新: 2026-07-08
 */

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
}));

const mockVaRService = {
  calculate: jest.fn().mockResolvedValue({}),
};
const mockPortfolioService = {
  getAllPortfolios: jest.fn().mockResolvedValue({ portfolios: [] }),
};

jest.mock('../../src/services/var.service', () => ({ VaRService: mockVaRService }));
jest.mock('../../src/services/portfolio.service', () => ({ PortfolioService: mockPortfolioService }));
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import cron from 'node-cron';
import { acquireLock, releaseLock, scheduleVaRCalculation } from '../../src/jobs/varCalculation.job';

describe('varCalculation.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset lock state by releasing
    releaseLock();
  });

  describe('acquireLock', () => {
    it('should acquire lock when not held', async () => {
      const result = await acquireLock();
      expect(result).toBe(true);
    });

    it('should fail to acquire when already held', async () => {
      await acquireLock();
      const result = await acquireLock();
      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should release lock', async () => {
      await acquireLock();
      await releaseLock();
      const result = await acquireLock();
      expect(result).toBe(true);
    });
  });

  describe('scheduleVaRCalculation', () => {
    it('should schedule cron job', () => {
      const task = scheduleVaRCalculation();
      expect(cron.schedule).toHaveBeenCalledWith('0 18 * * *', expect.any(Function));
      expect(task).toBeDefined();
    });

    it('should skip when lock already held', async () => {
      scheduleVaRCalculation();
      const callback = (cron.schedule as jest.Mock).mock.calls[0][1];
      await acquireLock();
      await callback();
      expect(mockPortfolioService.getAllPortfolios).not.toHaveBeenCalled();
    });

    it('should process portfolios when lock acquired', async () => {
      scheduleVaRCalculation();
      const callback = (cron.schedule as jest.Mock).mock.calls[0][1];
      mockPortfolioService.getAllPortfolios.mockResolvedValue({
        portfolios: [
          { user_id: 'u1', portfolio_id: 'p1' },
          { user_id: 'u2', portfolio_id: 'p2' },
        ],
      });
      await callback();
      expect(mockPortfolioService.getAllPortfolios).toHaveBeenCalledWith(1, 1000);
      expect(mockVaRService.calculate).toHaveBeenCalledTimes(2);
    });

    it('should handle batch delay', async () => {
      scheduleVaRCalculation();
      const callback = (cron.schedule as jest.Mock).mock.calls[0][1];
      const portfolios = Array.from({ length: 15 }, (_, i) => ({
        user_id: 'u' + i, portfolio_id: 'p' + i,
      }));
      mockPortfolioService.getAllPortfolios.mockResolvedValue({ portfolios });
      await callback();
      expect(mockVaRService.calculate).toHaveBeenCalledTimes(15);
    });
  });
});
