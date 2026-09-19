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
import { RiskEventService } from '../../src/services/riskEvent.service';
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
    // DEF-V131-002：is_processed 全局置位已移除（多用户消费缺陷），字段语义废弃，不再置位
    expect(events[0].is_processed).toBe(false);
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

  // DEF-V131-002（2026-09-19）：修复 is_processed 全局置位导致的多用户匹配失效
  it('DEF-V131-002: 无匹配持仓用户先匹配不应消耗事件，其他用户仍可匹配', async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);

    // 用户A：持仓 symbol/sector 均不命中任何演示事件
    const userA = userRepo.create({ username: 'test-f04-userA', email: 'f04-a@test.com' });
    await userRepo.save(userA);
    const pfA = portfolioRepo.create({ user_id: userA.user_id, name: 'A组合', type: 'personal', status: 'active' });
    await portfolioRepo.save(pfA);
    await holdingRepo.save(holdingRepo.create({ portfolio_id: pfA.portfolio_id, symbol: '999999', quantity: 100, cost_price: 10, sector: '无关行业', status: 'active' }));

    // 用户B：白酒持仓，命中 DEMO-EVT-001
    const userB = userRepo.create({ username: 'test-f04-userB', email: 'f04-b@test.com' });
    await userRepo.save(userB);
    const pfB = portfolioRepo.create({ user_id: userB.user_id, name: 'B组合', type: 'personal', status: 'active' });
    await portfolioRepo.save(pfB);
    await holdingRepo.save(holdingRepo.create({ portfolio_id: pfB.portfolio_id, symbol: '600519', quantity: 100, cost_price: 1600, sector: '白酒', status: 'active' }));

    try {
      // 用户A 先匹配：0 命中，但修复前会把全部事件全局置位消耗掉
      const countA = await RiskEventService.matchEventsForUser(userA.user_id);
      expect(countA).toBe(0);

      // 修复点：事件不被全局消耗，用户B 仍可匹配到
      const countB = await RiskEventService.matchEventsForUser(userB.user_id);
      expect(countB).toBeGreaterThanOrEqual(1);
      const impactsB = await impactRepo.find({ where: { user_id: userB.user_id } });
      expect(impactsB.length).toBeGreaterThanOrEqual(1);
    } finally {
      await impactRepo.delete({ user_id: userA.user_id });
      await impactRepo.delete({ user_id: userB.user_id });
      await holdingRepo.delete({ portfolio_id: pfA.portfolio_id });
      await holdingRepo.delete({ portfolio_id: pfB.portfolio_id });
      await portfolioRepo.delete({ portfolio_id: pfA.portfolio_id });
      await portfolioRepo.delete({ portfolio_id: pfB.portfolio_id });
      await userRepo.delete({ user_id: userA.user_id });
      await userRepo.delete({ user_id: userB.user_id });
    }
  });

  // DEF-V131-002（2026-09-19）：查询时惰性匹配，seed 之后的新用户无需重跑 seed
  it('DEF-V131-002: 新用户直接查询列表即可惰性匹配出事件', async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);

    // 用户C：seed 之后创建，从未跑过匹配管线
    const userC = userRepo.create({ username: 'test-f04-userC', email: 'f04-c@test.com' });
    await userRepo.save(userC);
    const pfC = portfolioRepo.create({ user_id: userC.user_id, name: 'C组合', type: 'personal', status: 'active' });
    await portfolioRepo.save(pfC);
    await holdingRepo.save(holdingRepo.create({ portfolio_id: pfC.portfolio_id, symbol: '600519', quantity: 100, cost_price: 1600, sector: '白酒', status: 'active' }));

    try {
      // 不调用 matchEventsForUser、不重跑 seed，直接查列表（getUserEvents 内部惰性匹配）
      const events = await RiskEventService.getUserEvents(userC.user_id, {});
      expect(events.total).toBeGreaterThanOrEqual(1);
      expect(events.list[0].title).toBeTruthy();
    } finally {
      await impactRepo.delete({ user_id: userC.user_id });
      await holdingRepo.delete({ portfolio_id: pfC.portfolio_id });
      await portfolioRepo.delete({ portfolio_id: pfC.portfolio_id });
      await userRepo.delete({ user_id: userC.user_id });
    }
  });
});
