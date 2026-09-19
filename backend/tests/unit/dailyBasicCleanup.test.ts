import { cleanupExpiredDailyBasicSnapshots } from '../../src/jobs/exportCleanup.job';
import { AppDataSource } from '../../src/config/database';
import { StockDailyBasic } from '../../src/models/StockDailyBasic';

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
  }),
  __esModule: true,
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
    }),
  },
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('PRME-v1.3-PA-003 §4.1 Daily Basic Snapshot Cleanup', () => {
  const repo = () => AppDataSource.getRepository(StockDailyBasic);

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  afterEach(async () => {
    await repo().clear();
  });

  describe('TC-SDBCLEAN.1: Expired snapshots should be cleaned', () => {
    it('should delete rows older than 3 calendar years and keep boundary rows', async () => {
      const now = new Date();
      const cutoff = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

      const expiredDate = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000); // 3年前 -1 天
      const keptBeforeCutoff = new Date(cutoff.getTime() + 24 * 60 * 60 * 1000); // 3年前 +1 天
      const today = now;

      const rows = [
        repo().create({ symbol: '600000', trade_date: toDateStr(expiredDate) as any, pe_ttm: 8.5, dv_ratio: 3.2 }),
        repo().create({ symbol: '600001', trade_date: toDateStr(keptBeforeCutoff) as any, pe_ttm: 9.1, dv_ratio: 2.8 }),
        repo().create({ symbol: '600002', trade_date: toDateStr(today) as any, pe_ttm: 10.2, dv_ratio: 1.5 }),
      ];
      await repo().save(rows);

      const result = await cleanupExpiredDailyBasicSnapshots();

      expect(result.deletedRows).toBe(1);

      // 过期行已删除
      const expiredCheck = await repo().findOne({ where: { symbol: '600000' } });
      expect(expiredCheck).toBeNull();
      // 3年前 +1 天（边界内）保留
      const keptCheck = await repo().findOne({ where: { symbol: '600001' } });
      expect(keptCheck).not.toBeNull();
      // 今天的行保留
      const todayCheck = await repo().findOne({ where: { symbol: '600002' } });
      expect(todayCheck).not.toBeNull();

      const remaining = await repo().count();
      expect(remaining).toBe(2);
    });
  });

  describe('TC-SDBCLEAN.2: Empty table should be a no-op', () => {
    it('should return deletedRows 0 when nothing is expired', async () => {
      const result = await cleanupExpiredDailyBasicSnapshots();
      expect(result.deletedRows).toBe(0);
    });
  });

  describe('TC-SDBCLEAN.3: Rows exactly on the cutoff should be kept', () => {
    it('should keep rows with trade_date equal to the cutoff (LessThan semantics)', async () => {
      const now = new Date();
      const cutoff = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

      await repo().save(repo().create({
        symbol: '600003',
        trade_date: toDateStr(cutoff) as any,
        pe_ttm: 7.7,
      }));

      const result = await cleanupExpiredDailyBasicSnapshots();
      expect(result.deletedRows).toBe(0);

      const kept = await repo().findOne({ where: { symbol: '600003' } });
      expect(kept).not.toBeNull();
    });
  });
});
