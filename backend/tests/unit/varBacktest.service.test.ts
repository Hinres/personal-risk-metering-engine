/**
 * [PRME-v1.3.2-V2-04] varBacktest.service 单元测试
 * 测试范围: coverage 对账、Kupiec 公式独立复算、n<30 降级、无数据降级、
 *           as-of 配对严格性（同日不参与）、边界不 exceed、属主 403/404
 * 说明: 设计 §7.7 要求"n=250,x=5,p=0.05 → LR≈0"与教科书公式不符（实际 LR≈6.16, p≈0.013），
 *       本套件按 Kupiec 标准公式独立复算对账，并以 n=250/x=30 构造 underestimate 基准。
 * 最后更新: 2026-09-19
 */
import { AppDataSource } from '../../src/config/database';
import {
  VarBacktestService,
  kupiecLR,
  chi2Survival1,
  erfcApprox,
} from '../../src/services/varBacktest.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { PortfolioSnapshot } from '../../src/models/PortfolioSnapshot';
import { VaRCalculation } from '../../src/models/VaRCalculation';

describe('VarBacktestService (V2-04)', () => {
  let userId: string;
  let otherUserId: string;
  let portfolioId: string;

  const dayStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const seedSnapshot = async (daysAgo: number, dailyReturn: number | null) => {
    const repo = AppDataSource.getRepository(PortfolioSnapshot);
    await repo.save(repo.create({
      portfolio_id: portfolioId,
      snapshot_date: new Date(dayStr(daysAgo)),
      daily_return: dailyReturn,
      total_market_value: 100000,
    } as Partial<PortfolioSnapshot>));
  };

  const seedVaR = async (daysAgo: number, varPct: number, confidence = 0.95, timeHorizon = 1) => {
    const repo = AppDataSource.getRepository(VaRCalculation);
    const calculatedAt = new Date();
    calculatedAt.setDate(calculatedAt.getDate() - daysAgo);
    await repo.save(repo.create({
      portfolio_id: portfolioId,
      user_id: userId,
      calculation_type: 'historical',
      confidence_level: confidence,
      time_horizon: timeHorizon,
      var_value: 10000,
      var_percentage: varPct,
      status: 'completed',
      calculated_at: calculatedAt,
    } as Partial<VaRCalculation>));
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const u = userRepo.create({ username: 'test-bt-user', email: 'bt@test.com' });
    await userRepo.save(u);
    userId = u.user_id;

    const u2 = userRepo.create({ username: 'test-bt-other', email: 'bt-other@test.com' });
    await userRepo.save(u2);
    otherUserId = u2.user_id;

    const pf = AppDataSource.getRepository(Portfolio).create({
      user_id: userId, name: '回测组合', type: 'personal', status: 'active',
    } as Partial<Portfolio>);
    await AppDataSource.getRepository(Portfolio).save(pf);
    portfolioId = (pf as any).portfolio_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const pfRepo = AppDataSource.getRepository(Portfolio);
    await AppDataSource.getRepository(PortfolioSnapshot).delete({ portfolio_id: portfolioId });
    await AppDataSource.getRepository(VaRCalculation).delete({ user_id: userId });
    await pfRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
    await userRepo.delete({ user_id: otherUserId });
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(PortfolioSnapshot).delete({ portfolio_id: portfolioId });
    await AppDataSource.getRepository(VaRCalculation).delete({ user_id: userId });
  });

  it('纯函数对账：erfc 已知值 + Kupiec LR 独立复算 + chi2(1) 生存函数', () => {
    // erfc 基准
    expect(erfcApprox(0)).toBeCloseTo(1, 6);
    expect(erfcApprox(1.755)).toBeCloseTo(0.0133, 2);

    // LR 独立复算（n=250, x=30, p=0.05）：
    // LR = -2[30ln(0.05/0.12) + 220ln(0.95/0.88)] ≈ 18.66
    const lr = kupiecLR(250, 30, 0.05);
    expect(lr).toBeGreaterThan(18);
    expect(lr).toBeLessThan(19.5);
    const p = chi2Survival1(lr);
    expect(p).toBeLessThan(0.001);

    // pass 场景（n=250, x=12, p=0.05）：LR 很小，p 很大
    const lrPass = kupiecLR(250, 12, 0.05);
    expect(chi2Survival1(lrPass)).toBeGreaterThan(0.5);

    // x=0 极限式不抛错
    expect(kupiecLR(250, 0, 0.05)).toBeCloseTo(-2 * 250 * Math.log(0.95), 6);
  });

  it('coverage 对账：正收益日不 exceed、恰等边界不 exceed（严格大于）、loss 超过才 exceed', async () => {
    // VaR 在 D-1 计算（as-of 严格早于 D）
    await seedVaR(10, 0.02);
    await seedSnapshot(9, 0.01);    // +1% 不 exceed
    await seedSnapshot(8, -0.02);   // -2% 恰等于 VaR → 不 exceed（严格大于）
    await seedSnapshot(7, -0.031);  // -3.1% > 2% → exceed
    await seedSnapshot(6, null);    // NULL 收益 → 跳过

    const r: any = await VarBacktestService.runBacktest(portfolioId, userId, 90);
    expect(r.samples).toBe(3);
    expect(r.exceedances).toBe(1);
    expect(r.coverage).toBeCloseTo(1 / 3, 4);
    expect(r.exceptions).toHaveLength(1);
    expect(r.exceptions[0].loss_multiple).toBeCloseTo(0.031 / 0.02, 4);
    // n=3 < 30 → insufficient_data
    expect(r.kupiec.verdict).toBe('insufficient_data');
  });

  it('as-of 配对严格性：同日 VaR 不参与当日样本；取严格早于 D 的最新一条', async () => {
    await seedVaR(5, 0.02); // D0-5
    await seedVaR(2, 0.03); // D0-2
    // 快照日 = D0-2（与最新 VaR 同日）→ 应配对到 D0-5 的 0.02，不是同日的 0.03
    await seedSnapshot(2, -0.025); // -2.5%：对 0.02 exceed；若错误用同日 0.03 则不 exceed
    await seedSnapshot(1, -0.025); // D0-1 → 配对 D0-2 的 0.03 → 不 exceed

    const r: any = await VarBacktestService.runBacktest(portfolioId, userId, 90);
    expect(r.samples).toBe(2);
    expect(r.exceedances).toBe(1);
    expect(r.exceptions[0].var_percentage).toBe(0.02);
  });

  it('Kupiec 端到端 underestimate：n=60 样本、12 次 exceed（20% >> 5%）→ p<0.05 且 underestimate', async () => {
    await seedVaR(70, 0.02);
    for (let i = 61; i >= 2; i--) {
      // 每 5 天 exceed 一次 → 60 天 12 次
      await seedSnapshot(i, i % 5 === 0 ? -0.031 : -0.001);
    }
    const r: any = await VarBacktestService.runBacktest(portfolioId, userId, 90);
    expect(r.samples).toBe(60);
    expect(r.exceedances).toBe(12);
    expect(r.kupiec.verdict).toBe('underestimate');
    expect(r.kupiec.p_value).toBeLessThan(0.05);
    expect(r.kupiec.message).toContain('低估');
  });

  it('Kupiec 端到端 pass：exceed 频率接近期望（60 天 3 次 ≈ 5%）', async () => {
    await seedVaR(70, 0.02);
    for (let i = 61; i >= 2; i--) {
      await seedSnapshot(i, i % 20 === 0 ? -0.031 : -0.001);
    }
    const r: any = await VarBacktestService.runBacktest(portfolioId, userId, 90);
    expect(r.samples).toBe(60);
    expect(r.exceedances).toBe(3);
    expect(r.kupiec.verdict).toBe('pass');
    expect(r.kupiec.p_value).toBeGreaterThanOrEqual(0.05);
  });

  it('窗口过滤：365 窗口外的样本不计入（180 窗口只取窗口内）', async () => {
    await seedVaR(300, 0.02); // 300 天前的 VaR
    await seedVaR(10, 0.02);
    await seedSnapshot(200, -0.031); // 180 窗口外
    await seedSnapshot(100, -0.031); // 180 窗口内
    await seedSnapshot(5, -0.001);

    const r180: any = await VarBacktestService.runBacktest(portfolioId, userId, 180);
    expect(r180.samples).toBe(2); // 200 天前的不计入
    const r365: any = await VarBacktestService.runBacktest(portfolioId, userId, 365);
    expect(r365.samples).toBe(3);
  });

  it('降级：无 VaR 记录 / 全 NULL var_percentage → samples=0 + insufficient_data', async () => {
    await seedSnapshot(5, -0.01);
    const r: any = await VarBacktestService.runBacktest(portfolioId, userId, 180);
    expect(r.samples).toBe(0);
    expect(r.kupiec.verdict).toBe('insufficient_data');
    expect(r.kupiec.message).toContain('配对');
  });

  it('校验与权限：非法 window 400、其他用户 404', async () => {
    await expect(VarBacktestService.runBacktest(portfolioId, userId, 120 as any))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(VarBacktestService.runBacktest(portfolioId, otherUserId, 180))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
