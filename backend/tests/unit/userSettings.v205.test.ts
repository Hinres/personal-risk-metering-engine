/**
 * [PRME-v1.3.2-V2-05] 用户设置补全测试
 * 测试范围: data 段深合并、非法值 400、local_only 取数策略、降级 data_quality 标记、
 *           consent 新枚举往返 + 未知类型 400、audit 埋点
 * 最后更新: 2026-09-19
 */
import { AppDataSource } from '../../src/config/database';
import { UserService } from '../../src/services/user.service';
import { ConsentService, VALID_CONSENT_TYPES } from '../../src/services/consent.service';
import { MarketDataService } from '../../src/services/marketData.service';
import { User } from '../../src/models/User';
import { UserConsent } from '../../src/models/UserConsent';
import { AuditLog } from '../../src/models/AuditLog';
import { MarketData } from '../../src/models/MarketData';

describe('V2-05 用户设置补全', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const u = userRepo.create({ username: 'test-v205-user', email: 'v205@test.com' });
    await userRepo.save(u);
    userId = u.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    await AppDataSource.getRepository(UserConsent).delete({ user_id: userId });
    await AppDataSource.getRepository(AuditLog).delete({ user_id: userId, resource_type: 'user_setting' });
    await AppDataSource.getRepository(MarketData).delete({ symbol: 'V205TEST' });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(async () => {
    // 重置偏好
    const userRepo = AppDataSource.getRepository(User);
    await userRepo.update({ user_id: userId }, { preferences: {} });
    await AppDataSource.getRepository(AuditLog).delete({ user_id: userId, resource_type: 'user_setting' });
  });

  describe('updatePreferences data 段', () => {
    it('深合并：仅提交 data.data_source 不丢 data.data_quality_alerts', async () => {
      await UserService.updatePreferences(userId, { data: { data_source: 'local_only', data_quality_alerts: true } });
      const after1: any = await UserService.getPreferences(userId);
      expect(after1.data).toEqual({ data_source: 'local_only', data_quality_alerts: true });

      await UserService.updatePreferences(userId, { data: { data_source: 'auto' } });
      const after2: any = await UserService.getPreferences(userId);
      expect(after2.data.data_source).toBe('auto');
      expect(after2.data.data_quality_alerts).toBe(true); // 深合并保留
    });

    it('顶层键浅合并回归（无 data 段时不新增空段）', async () => {
      await UserService.updatePreferences(userId, { language: 'zh-CN', theme: 'dark' });
      const prefs: any = await UserService.getPreferences(userId);
      expect(prefs.language).toBe('zh-CN');
      expect(prefs.theme).toBe('dark');
      await UserService.updatePreferences(userId, { theme: 'light' });
      const after: any = await UserService.getPreferences(userId);
      expect(after.theme).toBe('light');
      expect(after.language).toBe('zh-CN');
      expect(after.data).toBeUndefined(); // 无 data 提交时不新增空段
    });

    it('校验：非法 data_source / 非 boolean alerts → 400；data 非对象 → 400', async () => {
      await expect(
        UserService.updatePreferences(userId, { data: { data_source: 'remote_only' } })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        UserService.updatePreferences(userId, { data: { data_quality_alerts: 'yes' } })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        UserService.updatePreferences(userId, { data: 'invalid' as any })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('MarketDataService local_only 取数策略', () => {
    it('local_only：缓存 miss 返回 null（跳过 mock 远程回落），degraded=true', async () => {
      await UserService.updatePreferences(userId, { data: { data_source: 'local_only' } });
      const ctx: any = { userId };
      const price = await MarketDataService.getLatestPrice('V205_NODATA', ctx);
      expect(price).toBeNull();
      expect(ctx.degraded).toBe(true);
    });

    it('auto（默认）：缓存 miss 走 mock 回落返回非空（现状行为回归）', async () => {
      const ctx: any = { userId };
      const price = await MarketDataService.getLatestPrice('V205_NODATA', ctx);
      expect(price).not.toBeNull();
      expect(ctx.degraded).toBe(true);
    });

    it('缓存命中：不降级，degraded 不置位', async () => {
      const md = AppDataSource.getRepository(MarketData).create({
        symbol: 'V205TEST', trade_date: new Date(), close_price: 12.34, security_type: 'stock',
      } as Partial<MarketData>);
      await AppDataSource.getRepository(MarketData).save(md);

      const ctx: any = { userId };
      const price = await MarketDataService.getLatestPrice('V205TEST', ctx);
      expect(Number(price)).toBeCloseTo(12.34, 2);
      expect(ctx.degraded).toBeUndefined();
    });
  });

  describe('consent 扩展', () => {
    it('新枚举往返：授予 → 列表可见 → 撤销', async () => {
      for (const t of ['anonymous_sharing', 'benchmark_comparison']) {
        const r = await ConsentService.recordConsent(userId, t, 'miniprogram');
        expect(r.status).toBe('granted');
      }
      const consents = await ConsentService.getConsents(userId);
      const types = consents.map(c => c.consent_type);
      expect(types).toEqual(expect.arrayContaining(['anonymous_sharing', 'benchmark_comparison']));

      const revoked = await ConsentService.revokeConsent(userId, 'anonymous_sharing');
      expect(revoked.is_active).toBe(false);
      expect(await ConsentService.checkConsent(userId, 'anonymous_sharing')).toBe(false);
      expect(await ConsentService.checkConsent(userId, 'benchmark_comparison')).toBe(true);
    });

    it('既有类型回归：data_collection / optimization_advice 仍合法', () => {
      expect(VALID_CONSENT_TYPES).toEqual(expect.arrayContaining(['data_collection', 'optimization_advice', 'marketing']));
    });

    it('未知 consent_type → 400（授予与撤销均校验）', async () => {
      await expect(
        ConsentService.recordConsent(userId, 'unknown_type', 'api')
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        ConsentService.revokeConsent(userId, 'unknown_type')
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('设置历史埋点（audit_logs）', () => {
    it('preferences 更新 + consent 授予 + consent 撤销各产生 user_setting 审计记录', async () => {
      await UserService.updatePreferences(userId, { data: { data_source: 'local_only' } });
      await ConsentService.recordConsent(userId, 'anonymous_sharing', 'miniprogram');
      await ConsentService.revokeConsent(userId, 'anonymous_sharing');

      const logs = await AppDataSource.getRepository(AuditLog).find({
        where: { user_id: userId, resource_type: 'user_setting' },
        order: { created_at: 'ASC' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(3);

      const keys = logs.map(l => (l.details as any)?.key);
      expect(keys).toContain('preferences');
      const consentLogs = logs.filter(l => (l.details as any)?.key === 'consent');
      expect(consentLogs.some(l => (l.details as any)?.action === 'granted')).toBe(true);
      expect(consentLogs.some(l => (l.details as any)?.action === 'revoked')).toBe(true);
      expect(consentLogs.some(l => (l.details as any)?.consent_type === 'anonymous_sharing')).toBe(true);
    });
  });
});
