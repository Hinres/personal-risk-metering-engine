/**
 * [PRME-PA-001] portfolioSnapshot.service 单元测试
 * 测试范围: 当日快照幂等生成、日期范围查询稳定性
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { PortfolioSnapshotService } from '../../src/services/portfolioSnapshot.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { PortfolioSnapshot } from '../../src/models/PortfolioSnapshot';

jest.mock('../../src/services/portfolio.service', () => ({
  PortfolioService: {
    updateStatistics: jest.fn(),
    getRiskReturnAnalysis: jest.fn().mockResolvedValue({
      annual_return: 0.1,
      volatility: 0.15,
      sharpe_ratio: 0.5,
      total_return: 0.05,
    }),
  },
}));

describe('PortfolioSnapshotService', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);

    const user = userRepo.create({ username: 'test-snapshot-user', email: 'snapshot@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: '快照测试组合',
      type: 'personal',
      status: 'active',
      statistics: { total_value: 12000, total_cost: 10000 },
    });
    await portfolioRepo.save(portfolio);
    portfolioId = portfolio.portfolio_id;

    const holding = holdingRepo.create({
      portfolio_id: portfolioId,
      symbol: '000001',
      name: '平安银行',
      quantity: 100,
      cost_price: 10,
      current_price: 12,
      market_value: 1200,
      weight: 1,
      security_type: 'stock',
      currency: 'CNY',
      status: 'active',
    });
    await holdingRepo.save(holding);
  });

  afterAll(async () => {
    const snapshotRepo = AppDataSource.getRepository(PortfolioSnapshot);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const userRepo = AppDataSource.getRepository(User);
    await snapshotRepo.delete({ portfolio_id: portfolioId });
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(async () => {
    const snapshotRepo = AppDataSource.getRepository(PortfolioSnapshot);
    await snapshotRepo.delete({ portfolio_id: portfolioId });
  });

  it('B-05: 同日多次生成快照应更新同一条记录，不产生重复', async () => {
    const first = await PortfolioSnapshotService.createSnapshot(portfolioId);
    const second = await PortfolioSnapshotService.createSnapshot(portfolioId);

    expect(second.snapshot_id).toBe(first.snapshot_id);

    const snapshotRepo = AppDataSource.getRepository(PortfolioSnapshot);
    const all = await snapshotRepo.find({ where: { portfolio_id: portfolioId } });
    expect(all.length).toBe(1);
  });

  it('应正确获取历史对比数据', async () => {
    await PortfolioSnapshotService.createSnapshot(portfolioId);
    const result = await PortfolioSnapshotService.getHistoricalComparison(
      portfolioId,
      userId,
      '3m'
    );
    expect(result.period).toBe('3m');
    expect(result.current).toHaveProperty('total_value');
    expect(result.changes).toHaveProperty('total_value_change');
  });
});
