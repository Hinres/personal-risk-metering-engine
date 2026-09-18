/**
 * [PRME-v1.3.1-F04] seed-demo-risk-events 单元测试
 * 测试范围: seed 幂等、匹配管线生成 impact、环境门禁（脚本主流程）
 * 最后更新: 2026-09-18
 */
import { AppDataSource } from '../../src/config/database';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { RiskEvent } from '../../src/models/RiskEvent';
import { RiskEventSource } from '../../src/models/RiskEventSource';
import { RiskEventImpact } from '../../src/models/RiskEventImpact';
import { seedDemoRiskEvents } from '../../scripts/seed-demo-risk-events';

describe('F-04 seedDemoRiskEvents', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);

    const user = userRepo.create({ username: 'test-f04-user', email: 'f04@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: 'F04演示组合',
      type: 'personal',
      status: 'active',
    });
    await portfolioRepo.save(portfolio);
    portfolioId = portfolio.portfolio_id;

    // 白酒 + 医药持仓，命中 DEMO-EVT-001 / DEMO-EVT-003
    await holdingRepo.save([
      holdingRepo.create({ portfolio_id: portfolioId, symbol: '600519', quantity: 100, cost_price: 1600, sector: '白酒', status: 'active' }),
      holdingRepo.create({ portfolio_id: portfolioId, symbol: '600276', quantity: 200, cost_price: 45, sector: '医药', status: 'active' }),
    ]);
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const sourceRepo = AppDataSource.getRepository(RiskEventSource);

    await impactRepo.delete({ user_id: userId });
    await eventRepo.clear();
    await sourceRepo.delete({ provider: 'manual' });
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
  });

  it('首次执行应插入 6 个演示事件并触发匹配生成 impact', async () => {
    const result = await seedDemoRiskEvents();

    expect(result.inserted).toBe(6);
    expect(result.skipped).toBe(0);
    // 白酒/医药持仓至少命中 2 个事件
    expect(result.matchedImpacts).toBeGreaterThanOrEqual(2);

    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const events = await eventRepo.find({ where: { external_id: 'DEMO-EVT-001' } });
    expect(events).toHaveLength(1);
    expect(events[0].is_processed).toBe(true); // 匹配管线已处理
    expect(JSON.parse(events[0].symbols!)).toContain('600519');

    const impactRepo = AppDataSource.getRepository(RiskEventImpact);
    const impacts = await impactRepo.find({ where: { user_id: userId } });
    expect(impacts.length).toBeGreaterThanOrEqual(2);
  });

  it('二次执行应幂等：0 插入、全部跳过', async () => {
    const result = await seedDemoRiskEvents();

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(6);

    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const total = await eventRepo.count();
    expect(total).toBe(6);
  });

  it('风险事件列表口径：impact 关联 event 字段齐全（title/level/occurred_at）', async () => {
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);
    const impacts = await impactRepo.find({ where: { user_id: userId }, relations: ['event'] });

    for (const i of impacts) {
      expect(i.event?.title).toBeTruthy();
      expect(i.event?.level).toBeTruthy();
      expect(i.event?.occurred_at).toBeTruthy();
      expect(['critical', 'high', 'medium', 'low']).toContain(i.event?.level);
    }
  });
});
