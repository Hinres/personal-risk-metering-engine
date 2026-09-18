/**
 * [PRME-v1.3.1-F01] purchase_date 迁移与序列化单元测试
 * 测试范围: 008 迁移回填、serializeHolding 列优先/metadata 兜底、编辑清空置 NULL
 * 最后更新: 2026-09-18
 */
import { AppDataSource } from '../../src/config/database';
import { Holding } from '../../src/models/Holding';
import { Portfolio } from '../../src/models/Portfolio';
import { User } from '../../src/models/User';
import { HoldingService } from '../../src/services/holding.service';
import { PurchaseDateMigration1718000000008, toDateString } from '../../src/database/migrations/008-v1.3.1-purchase-date-migration';

describe('F-01 purchase_date', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);

    const user = userRepo.create({ username: 'test-f01-user', email: 'f01@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: 'F01测试组合',
      type: 'personal',
      status: 'active',
    });
    await portfolioRepo.save(portfolio);
    portfolioId = portfolio.portfolio_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
  });

  describe('008 迁移', () => {
    it('toDateString 应兼容 Date 对象 / 时间戳串 / 非法值', () => {
      expect(toDateString(new Date('2026-01-15T00:00:00.000Z'))).toBe('2026-01-15');
      expect(toDateString('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
      expect(toDateString('2026-01-15')).toBe('2026-01-15');
      expect(toDateString('')).toBeNull();
      expect(toDateString(null)).toBeNull();
      expect(toDateString('2026/13/45')).toBeNull();
    });

    it('backfill 应把 metadata.purchase_date 回填到列，且幂等', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const created = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01001',
        quantity: 100,
        cost_price: 10,
        purchase_date: null,
        metadata: { purchase_date: '2025-06-30' },
      });
      const created2 = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01002',
        quantity: 100,
        cost_price: 10,
        purchase_date: null,
        metadata: { purchase_date: 'bad-date' },
      });
      await holdingRepo.save([created, created2]);

      const migration = new PurchaseDateMigration1718000000008();
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      const updated = await migration.backfill(queryRunner);
      expect(updated).toBe(1); // 仅合法日期行回填

      const after1 = await holdingRepo.findOne({ where: { holding_id: created.holding_id } });
      const toStr = (v: any) => (v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null);
      expect(toStr(after1!.purchase_date)).toBe('2025-06-30');

      // 幂等：第二次执行 0 回填
      const updated2 = await migration.backfill(queryRunner);
      expect(updated2).toBe(0);

      await queryRunner.release();
      await holdingRepo.delete({ holding_id: created.holding_id });
      await holdingRepo.delete({ holding_id: created2.holding_id });
    });
  });

  describe('serializeHolding / 列写入', () => {
    it('serializeHolding：列优先，metadata 兜底，无日期返回 null', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const h1 = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01101',
        quantity: 1,
        cost_price: 1,
        purchase_date: new Date('2026-02-20T00:00:00.000Z'),
        metadata: { purchase_date: '2020-01-01' },
      });
      const h2 = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01102',
        quantity: 1,
        cost_price: 1,
        purchase_date: null,
        metadata: { purchase_date: '2024-12-31' },
      });
      const h3 = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01103',
        quantity: 1,
        cost_price: 1,
        purchase_date: null,
        metadata: {},
      });
      await holdingRepo.save([h1, h2, h3]);

      const s1 = HoldingService.serializeHolding(h1);
      const s2 = HoldingService.serializeHolding(h2);
      const s3 = HoldingService.serializeHolding(h3);
      expect(s1.purchase_date).toBe('2026-02-20'); // 列优先
      expect(s2.purchase_date).toBe('2024-12-31'); // metadata 兜底
      expect(s3.purchase_date).toBeNull();         // 无日期 → null（非空串）

      await holdingRepo.delete([h1.holding_id, h2.holding_id, h3.holding_id]);
    });

    it('normalizePurchaseDateColumn：undefined 保持 / 合法日期 / 清空置 NULL', () => {
      expect(HoldingService.normalizePurchaseDateColumn(undefined)).toBeUndefined();
      expect(
        (HoldingService.normalizePurchaseDateColumn('2026-01-15') as Date).toISOString().slice(0, 10)
      ).toBe('2026-01-15');
      expect(HoldingService.normalizePurchaseDateColumn('')).toBeNull();
      expect(HoldingService.normalizePurchaseDateColumn(null)).toBeNull();
    });

    it('update：编辑清空日期 → purchase_date 列置 NULL', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const h = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01201',
        quantity: 1,
        cost_price: 1,
        purchase_date: new Date('2026-02-20T00:00:00.000Z'),
        metadata: { purchase_date: '2026-02-20' },
      });
      await holdingRepo.save(h);

      await HoldingService.update(h.holding_id, userId, { purchase_date: '' });

      const after = await holdingRepo.findOne({ where: { holding_id: h.holding_id } });
      expect(after!.purchase_date === null || after!.purchase_date === undefined).toBe(true);

      await holdingRepo.delete({ holding_id: h.holding_id });
    });

    it('update：提交合法日期 → 列与 metadata 双写', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const h = holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'F01202',
        quantity: 1,
        cost_price: 1,
        purchase_date: null,
        metadata: {},
      });
      await holdingRepo.save(h);

      await HoldingService.update(h.holding_id, userId, { purchase_date: '2026-05-01' });

      const after = await holdingRepo.findOne({ where: { holding_id: h.holding_id } });
      const toStr = (v: any) => (v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null);
      expect(toStr(after!.purchase_date)).toBe('2026-05-01');
      expect(after!.metadata?.purchase_date).toBe('2026-05-01');

      await holdingRepo.delete({ holding_id: h.holding_id });
    });
  });
});
