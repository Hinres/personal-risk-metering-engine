/**
 * [PRME-PA-001] marketAlert.service 单元测试
 * 测试范围: getUserAlerts, acknowledgeAlert, acknowledgeAllAlerts, getAlertStats, getUnacknowledgedCount
 * 最后更新: 2026-07-08
 */

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    }),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AppDataSource } from '../../src/config/database';
import { MarketAlertService } from '../../src/services/marketAlert.service';

describe('MarketAlertService', () => {
  let repo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = (AppDataSource.getRepository as jest.Mock)();
  });

  describe('getUserAlerts', () => {
    it('should return empty alerts', async () => {
      const result = await MarketAlertService.getUserAlerts('user-1');
      expect(result.alerts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter acknowledged=true', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([
        [{ alert_id: 'a1', index_symbol: 'SH', index_name: '上证', previous_close: 3000, current_close: 3150, change_percentage: 0.05, title: 'Alert', message: 'msg', triggered_at: new Date(), created_at: new Date() }],
        1,
      ]);
      qb.getMany.mockResolvedValue([
        { alert_id: 'a1', acknowledged_at: new Date() },
      ]);
      const result = await MarketAlertService.getUserAlerts('user-1', { acknowledged: true });
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].acknowledged).toBe(true);
    });

    it('should filter acknowledged=false', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([
        [{ alert_id: 'a1', index_symbol: 'SH', index_name: '上证', previous_close: 3000, current_close: 3150, change_percentage: 0.05, title: 'Alert', message: 'msg', triggered_at: new Date(), created_at: new Date() }],
        1,
      ]);
      qb.getMany.mockResolvedValue([]);
      const result = await MarketAlertService.getUserAlerts('user-1', { acknowledged: false });
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].acknowledged).toBe(false);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should throw when alert not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(MarketAlertService.acknowledgeAlert('user-1', 'a1')).rejects.toThrow('Alert not found');
    });

    it('should return already acknowledged', async () => {
      repo.findOne.mockResolvedValue({ alert_id: 'a1' });
      const qb = repo.createQueryBuilder();
      qb.getOne.mockResolvedValue({ alert_id: 'a1', acknowledged_at: new Date() });
      const result = await MarketAlertService.acknowledgeAlert('user-1', 'a1');
      expect(result.alreadyAcknowledged).toBe(true);
    });

    it('should create new acknowledgment', async () => {
      repo.findOne.mockResolvedValueOnce({ alert_id: 'a1' }).mockResolvedValueOnce(null);
      repo.create.mockReturnValue({ user_id: 'user-1', alert_id: 'a1' });
      const result = await MarketAlertService.acknowledgeAlert('user-1', 'a1');
      expect(result.alreadyAcknowledged).toBe(false);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('acknowledgeAllAlerts', () => {
    it('should return 0 when no alerts', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      const result = await MarketAlertService.acknowledgeAllAlerts('user-1');
      expect(result.acknowledged_count).toBe(0);
    });

    it('should acknowledge all unacknowledged alerts', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([
        { alert_id: 'a1' }, { alert_id: 'a2' },
      ]);
      qb.getMany.mockResolvedValueOnce([
        { alert_id: 'a1' }, { alert_id: 'a2' },
      ]).mockResolvedValueOnce([
        { alert_id: 'a1' },
      ]);
      repo.create.mockReturnValue({});
      const result = await MarketAlertService.acknowledgeAllAlerts('user-1');
      expect(result.acknowledged_count).toBe(1);
      expect(repo.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAlertStats', () => {
    it('should return stats', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([
        [{ alert_id: 'a1', index_symbol: 'SH', index_name: '上证', previous_close: 3000, current_close: 3150, change_percentage: 0.05, title: 'Alert', message: 'msg', triggered_at: new Date(), created_at: new Date() }],
        1,
      ]);
      qb.getMany.mockResolvedValue([]);
      const result = await MarketAlertService.getAlertStats('user-1');
      expect(result.total_alerts_30d).toBe(1);
      expect(result.acknowledgment_rate).toBe(0);
    });
  });

  describe('getUnacknowledgedCount', () => {
    it('should return 0 when no alerts', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      const result = await MarketAlertService.getUnacknowledgedCount('user-1');
      expect(result).toBe(0);
    });

    it('should return count of unacknowledged alerts', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([
        { alert_id: 'a1' }, { alert_id: 'a2' },
      ]);
      qb.getMany.mockResolvedValueOnce([
        { alert_id: 'a1' }, { alert_id: 'a2' },
      ]).mockResolvedValueOnce([
        { alert_id: 'a1' },
      ]);
      const result = await MarketAlertService.getUnacknowledgedCount('user-1');
      expect(result).toBe(1);
    });
  });
});
