/**
 * [PRME-v1.3.1-F03A] marketVolatility.job 单元测试
 * 测试范围: 调度函数返回 cron 句柄、runMarketVolatilityCalculation 容错
 * 最后更新: 2026-09-18
 */
import cron from 'node-cron';
import { scheduleMarketVolatility, runMarketVolatilityCalculation } from '../../src/jobs/marketVolatility.job';
import { MarketVolatilityService } from '../../src/services/marketVolatility.service';

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/services/marketVolatility.service', () => ({
  MarketVolatilityService: {
    calculateAndSaveAll: jest.fn(),
  },
}));

describe('marketVolatility.job（F-03A）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scheduleMarketVolatility 应以每交易日 17:30（Asia/Shanghai）调度', () => {
    const task = scheduleMarketVolatility();

    expect(task).toBeDefined();
    expect(typeof task.stop).toBe('function');
    expect(cron.schedule).toHaveBeenCalledWith(
      '30 17 * * 1-5',
      expect.any(Function),
      expect.objectContaining({ scheduled: true, timezone: 'Asia/Shanghai' })
    );
  });

  it('runMarketVolatilityCalculation 应调用 calculateAndSaveAll 并返回保存数', async () => {
    (MarketVolatilityService.calculateAndSaveAll as jest.Mock).mockResolvedValue(3);

    const saved = await runMarketVolatilityCalculation();
    expect(saved).toBe(3);
    expect(MarketVolatilityService.calculateAndSaveAll).toHaveBeenCalledTimes(1);
  });

  it('计算失败时应记录错误并返回 0（单指数失败不中断由服务内保证）', async () => {
    (MarketVolatilityService.calculateAndSaveAll as jest.Mock).mockRejectedValue(new Error('db down'));

    const saved = await runMarketVolatilityCalculation();
    expect(saved).toBe(0);
  });
});
