/**
 * [PRME-RM-005] riskEvent.service 单元测试
 * 测试范围: 事件匹配持仓、已读确认、列表查询
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { RiskEventService } from '../../src/services/riskEvent.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { RiskEvent } from '../../src/models/RiskEvent';
import { RiskEventImpact } from '../../src/models/RiskEventImpact';
import { RiskEventSource } from '../../src/models/RiskEventSource';

describe('RiskEventService', () => {
  let userId: string;
  let portfolioId: string;
  let sourceId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const sourceRepo = AppDataSource.getRepository(RiskEventSource);

    const user = userRepo.create({ username: 'test-risk-user', email: 'risk@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: '风险事件测试组合',
      type: 'personal',
      status: 'active',
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
      sector: '金融',
      security_type: 'stock',
      currency: 'CNY',
      status: 'active',
    });
    await holdingRepo.save(holding);

    const source = sourceRepo.create({
      source_type: 'announcement',
      provider: 'manual',
      name: '测试来源',
      config: '{}',
      is_active: true,
    });
    await sourceRepo.save(source);
    sourceId = source.source_id;
  });

  afterAll(async () => {
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const userRepo = AppDataSource.getRepository(User);
    const sourceRepo = AppDataSource.getRepository(RiskEventSource);

    await impactRepo.delete({ user_id: userId });
    await eventRepo.clear();
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
    await sourceRepo.delete({ source_id: sourceId });
  });

  beforeEach(async () => {
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const impactRepo = AppDataSource.getRepository(RiskEventImpact);
    await impactRepo.delete({ user_id: userId });
    await eventRepo.clear();
  });

  it('应将未处理事件匹配到用户持仓', async () => {
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const event = eventRepo.create({
      source_id: sourceId,
      source_type: 'announcement',
      title: '平安银行业绩公告',
      occurred_at: new Date(),
      level: 'high',
      symbols: JSON.stringify(['000001']),
      sectors: JSON.stringify(['金融']),
      is_processed: false,
    });
    await eventRepo.save(event);

    const count = await RiskEventService.matchEventsForUser(userId);
    expect(count).toBeGreaterThan(0);

    const events = await RiskEventService.getUserEvents(userId, {});
    expect(events.total).toBe(1);
    expect(events.list[0].title).toBe('平安银行业绩公告');
  });

  it('已读确认后 is_read 应为 true', async () => {
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const event = eventRepo.create({
      source_id: sourceId,
      source_type: 'announcement',
      title: '测试事件',
      occurred_at: new Date(),
      level: 'medium',
      symbols: JSON.stringify(['000001']),
      is_processed: false,
    });
    await eventRepo.save(event);

    await RiskEventService.matchEventsForUser(userId);
    const events = await RiskEventService.getUserEvents(userId, {});
    const eventId = events.list[0].event_id;

    const ack = await RiskEventService.acknowledge(eventId, userId);
    expect(ack).toHaveProperty('acknowledged_at');

    const after = await RiskEventService.getUserEvents(userId, { acknowledged: false });
    expect(after.total).toBe(0);
  });

  it('按 level 筛选应仅返回对应级别事件', async () => {
    const eventRepo = AppDataSource.getRepository(RiskEvent);
    const event = eventRepo.create({
      source_id: sourceId,
      source_type: 'announcement',
      title: '高危事件',
      occurred_at: new Date(),
      level: 'critical',
      symbols: JSON.stringify(['000001']),
      is_processed: false,
    });
    await eventRepo.save(event);

    await RiskEventService.matchEventsForUser(userId);
    const result = await RiskEventService.getUserEvents(userId, { level: 'critical' });
    expect(result.total).toBe(1);
    expect(result.list[0].level).toBe('critical');
  });
});
