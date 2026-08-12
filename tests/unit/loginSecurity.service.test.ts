/**
 * [PRME-PA-001] loginSecurity.service 单元测试
 * 测试范围: recordLogin, detectAnomalies, sendSecurityAlert, getLoginHistory, getActiveDevices
 * 最后更新: 2026-07-08
 */

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
  },
}));


jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AppDataSource } from '../../src/config/database';
import { LoginSecurityService } from '../../src/services/loginSecurity.service';
import { NotificationService } from '../../src/services/notification.service';

describe('LoginSecurityService', () => {
  let repo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = (AppDataSource.getRepository as jest.Mock)();
    jest.spyOn(NotificationService, 'send').mockResolvedValue([]);
  });

  describe('recordLogin', () => {
    it('should record successful login', async () => {
      await LoginSecurityService.recordLogin({
        userId: 'user-1',
        loginType: 'password',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        deviceFingerprint: 'fp1',
        isSuccessful: true,
      });
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('should handle optional params', async () => {
      await LoginSecurityService.recordLogin({
        userId: 'user-1',
        loginType: 'wechat',
        isSuccessful: true,
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: null,
        user_agent: null,
        device_fingerprint: null,
      }));
    });

    it('should handle save failure', async () => {
      repo.save.mockRejectedValue(new Error('DB error'));
      await expect(LoginSecurityService.recordLogin({
        userId: 'user-1',
        loginType: 'password',
        isSuccessful: true,
      })).resolves.toBeUndefined();
    });
  });

  describe('detectAnomalies', () => {
    it('should return low risk with no anomalies', async () => {
      const now = new Date();
      now.setHours(12);
      jest.useFakeTimers().setSystemTime(now);
      repo.find.mockResolvedValue([]);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      expect(result.risk_level).toBe('low');
      expect(result.anomalies).toHaveLength(0);
      jest.useRealTimers();
    });

    it('should detect brute force (5 failures in 15 min)', async () => {
      const now = new Date();
      const failures = Array.from({ length: 5 }, () => ({
        is_successful: false,
        created_at: new Date(now.getTime() - 5 * 60000),
      }));
      repo.find.mockResolvedValue(failures);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      console.log('anomalies:', result.anomalies);
      expect(result.risk_level).toBe('high');
      expect(result.anomalies.some((a: string) => a.includes('暴力破解'))).toBe(true);
    });

    it('should detect 3 failures in 15 min', async () => {
      const now = new Date();
      const failures = Array.from({ length: 3 }, () => ({
        is_successful: false,
        created_at: new Date(now.getTime() - 5 * 60000),
      }));
      repo.find.mockResolvedValue(failures);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      expect(result.risk_level).toBe('medium');
    });

    it('should detect new device', async () => {
      repo.find.mockResolvedValue([{
        is_successful: true,
        device_fingerprint: 'fp1',
        created_at: new Date(),
      }]);
      const result = await LoginSecurityService.detectAnomalies({
        userId: 'user-1',
        deviceFingerprint: 'fp2',
      });
      expect(result.anomalies).toContain('检测到新设备登录');
    });

    it('should detect new IP', async () => {
      repo.find.mockResolvedValue([{
        is_successful: true,
        ip_address: '192.168.1.1',
        created_at: new Date(),
      }]);
      const result = await LoginSecurityService.detectAnomalies({
        userId: 'user-1',
        ipAddress: '192.168.1.2',
      });
      expect(result.anomalies.some((a: string) => a.includes('新IP'))).toBe(true);
    });

    it('should detect too many logins in 1 hour', async () => {
      const now = new Date();
      const logins = Array.from({ length: 10 }, () => ({
        is_successful: true,
        created_at: new Date(now.getTime() - 30 * 60000),
      }));
      repo.find.mockResolvedValue(logins);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      expect(result.risk_level).toBe('high');
      expect(result.anomalies.some((a: string) => a.includes('会话行为异常'))).toBe(true);
    });

    it('should detect off-hours login', async () => {
      const now = new Date();
      now.setHours(3);
      jest.useFakeTimers().setSystemTime(now);
      repo.find.mockResolvedValue([]);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      expect(result.anomalies).toContain('非工作时间登录');
      jest.useRealTimers();
    });

    it('should notify when high risk', async () => {
      const now = new Date();
      const failures = Array.from({ length: 5 }, () => ({
        is_successful: false,
        created_at: new Date(now.getTime() - 5 * 60000),
      }));
      repo.find.mockResolvedValue(failures);
      const result = await LoginSecurityService.detectAnomalies({ userId: 'user-1' });
      expect(result.shouldNotify).toBe(true);
    });
  });

  describe('sendSecurityAlert', () => {
    it('should send alert', async () => {
      await LoginSecurityService.sendSecurityAlert('user-1', ['anomaly1']);
      expect(NotificationService.send).toHaveBeenCalled();
    });

    it('should handle send failure', async () => {
      (NotificationService.send as jest.Mock).mockRejectedValue(new Error('send failed'));
      await expect(LoginSecurityService.sendSecurityAlert('user-1', ['anomaly1'])).resolves.toBeUndefined();
    });
  });

  describe('getLoginHistory', () => {
    it('should return history with defaults', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await LoginSecurityService.getLoginHistory('user-1');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(0);
    });

    it('should return history with custom options', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await LoginSecurityService.getLoginHistory('user-1', { page: 2, limit: 50, days: 7 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });
  });

  describe('getActiveDevices', () => {
    it('should return empty when no history', async () => {
      repo.find.mockResolvedValue([]);
      const result = await LoginSecurityService.getActiveDevices('user-1');
      expect(result).toHaveLength(0);
    });

    it('should aggregate devices', async () => {
      const now = new Date();
      repo.find.mockResolvedValue([
        { device_fingerprint: 'fp1', created_at: now, ip_address: '127.0.0.1', is_successful: true },
        { device_fingerprint: 'fp1', created_at: new Date(now.getTime() - 1000), ip_address: '127.0.0.2', is_successful: true },
        { device_fingerprint: 'fp2', created_at: new Date(now.getTime() - 2000), ip_address: '192.168.1.1', is_successful: true },
      ]);
      const result = await LoginSecurityService.getActiveDevices('user-1');
      expect(result).toHaveLength(2);
      const fp1 = result.find((d: any) => d.deviceFingerprint === 'fp1');
      expect(fp1?.loginCount).toBe(2);
      expect(fp1?.lastIp).toBe('127.0.0.1');
    });
  });
});
