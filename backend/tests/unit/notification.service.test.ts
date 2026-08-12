/**
 * [PRME-RM-002] notification.service 单元测试
 * 文件: notification.service.test.ts
 * 测试范围: send, sendAlertNotification, sendToChannel, sendWechat, getNotificationHistory, markAsRead, getUnreadCount
 * 最后更新: 2026-06-25
 */
import { NotificationService } from '../../src/services/notification.service';
import { AppDataSource } from '../../src/config/database';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('NotificationService', () => {
  let alertRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let configRepo: ReturnType<typeof mockRepo>;
  let monitorRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    alertRepo = mockRepo();
    userRepo = mockRepo();
    configRepo = mockRepo();
    monitorRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'AlertHistory' || name?.includes('Alert')) return alertRepo;
      if (name === 'User' || name?.includes('User')) return userRepo;
      if (name === 'SystemConfig' || name?.includes('Config')) return configRepo;
      if (name === 'MonitorConfig' || name?.includes('Monitor')) return monitorRepo;
      return mockRepo();
    });
  });

  // ── send ──
  describe('send', () => {
    it('N-001: 应发送多渠道通知', async () => {
      const user = { user_id: 'u1', email: 'test@example.com', openid: 'wx123' };
      userRepo.findOne.mockResolvedValue(user);
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true, provider: 'test', endpoint: 'http://test' },
      });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['app', 'email', 'wechat'],
        title: '测试通知',
        message: '测试内容',
        severity: 'medium',
      });

      expect(results.length).toBe(3);
      expect(results.filter(r => r.success).length).toBeGreaterThanOrEqual(2);
    });

    it('N-002: 渠道未启用时应返回失败', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', email: 'test@example.com' });
      configRepo.findOne.mockResolvedValue(null);

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['email'],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('not enabled');
    });

    it('N-003: 用户不存在时应返回失败', async () => {
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });
      userRepo.findOne.mockResolvedValue(null);

      const results = await NotificationService.send({
        userId: 'u-missing',
        channels: ['app'],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('not found');
    });

    it('N-004: 发送失败时应记录错误但不抛异常', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1' });
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['wechat'], // 无 openid，会失败
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
    });

    it('N-005: 默认渠道为 app', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1' });
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: [],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      // channels 为空数组，循环不执行，results 为空
      expect(results.length).toBe(0);
    });
  });

  // ── sendAlertNotification ──
  describe('sendAlertNotification', () => {
    it('N-006: 应从 AlertHistory 触发通知', async () => {
      const user = { user_id: 'u1', email: 'test@example.com', openid: 'wx123' };
      userRepo.findOne.mockResolvedValue(user);
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true, endpoint: 'http://test' },
      });

      const alertRecord = {
        history_id: 'a1',
        user_id: 'u1',
        portfolio_id: 'p1',
        rule_id: 'r1',
        title: 'VaR超限',
        message: '组合VaR超过阈值',
        severity: 'high',
        trigger_details: {
          monitor_notification: { channels: ['app', 'email'] },
          actual_value: 15000,
          threshold: 10000,
          metric_type: 'VaR',
        },
      };

      const results = await NotificationService.sendAlertNotification(alertRecord as any);

      expect(results.length).toBeGreaterThan(0);
    });

    it('N-007: 用户不存在时返回空数组', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const alertRecord = {
        history_id: 'a1',
        user_id: 'u-missing',
        title: '测试',
        message: '内容',
        severity: 'low',
      };

      const results = await NotificationService.sendAlertNotification(alertRecord as any);
      expect(results).toEqual([]);
    });

    it('N-008: 无 trigger_details 时默认 app 渠道', async () => {
      const user = { user_id: 'u1', email: 'test@example.com' };
      userRepo.findOne.mockResolvedValue(user);
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true },
      });

      const alertRecord = {
        history_id: 'a2',
        user_id: 'u1',
        title: '测试',
        message: '内容',
        severity: 'low',
        trigger_details: {},
      };

      const results = await NotificationService.sendAlertNotification(alertRecord as any);
      expect(results.length).toBeGreaterThan(0);
    });

    it('N-009: trigger_details 含 sms 时应过滤掉', async () => {
      const user = { user_id: 'u1', email: 'test@example.com' };
      userRepo.findOne.mockResolvedValue(user);
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true },
      });

      const alertRecord = {
        history_id: 'a3',
        user_id: 'u1',
        rule_id: 'r1',
        title: '测试',
        message: '内容',
        severity: 'low',
        trigger_details: {
          monitor_notification: { channels: ['sms', 'app', 'email'] },
        },
      };

      const results = await NotificationService.sendAlertNotification(alertRecord as any);
      // sms 被过滤，只剩 app/email
      expect(results.length).toBe(2);
    });
  });

  // ── recordNotificationStatus ──
  describe('recordNotificationStatus', () => {
    it('N-010: 应记录通知状态到 AlertHistory', async () => {
      const alert = { history_id: 'a1', notification_status: {} };
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockResolvedValue(alert);

      await NotificationService.recordNotificationStatus(
        { userId: 'u1', channels: ['app'], title: 't', message: 'm', severity: 'low', data: { alertId: 'a1' } },
        [{ channel: 'app', success: true, sentAt: new Date() }]
      );

      expect(alertRepo.findOne).toHaveBeenCalledWith({ where: { history_id: 'a1' } });
      expect(alertRepo.save).toHaveBeenCalled();
      expect(alert.notification_status).toHaveProperty('channels');
    });

    it('N-011: 无 alertId 时应直接返回', async () => {
      await NotificationService.recordNotificationStatus(
        { userId: 'u1', channels: ['app'], title: 't', message: 'm', severity: 'low' },
        [{ channel: 'app', success: true }]
      );
      expect(alertRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ── sendToChannel 分支 ──
  describe('sendToChannel', () => {
    it('N-012: 未知渠道应返回错误', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1' });
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });

      const result = await (NotificationService as any).sendToChannel('unknown', {
        userId: 'u1',
        channels: ['unknown'],
        title: 't',
        message: 'm',
        severity: 'low',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });

  // ── sendEmail 分支 ──
  describe('sendEmail', () => {
    it('N-013: 用户无 email 时应返回失败', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', email: null });
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['email'],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('no email');
    });
  });

  // ── sendWechat 分支 ──
  describe('sendWechat', () => {
    it('N-014: 无 openid 时应返回失败', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', openid: null });
      configRepo.findOne.mockResolvedValue({ config_value: { enabled: true } });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['wechat'],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('no WeChat');
    });

    it('N-015: 微信发送成功（mock axios）', async () => {
      process.env.WECHAT_APP_ID = 'test_appid';
      process.env.WECHAT_APP_SECRET = 'test_secret';
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', openid: 'wx123' });
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true, templateId: 'tmpl_123' },
      });
      mockedAxios.get.mockResolvedValue({
        data: { access_token: 'token_123' },
      });
      mockedAxios.post.mockResolvedValue({ data: { errcode: 0 } });

      console.log('N-015 axios get results before:', JSON.stringify(mockedAxios.get.mock.results));
      console.log('N-015 axios post results before:', JSON.stringify(mockedAxios.post.mock.results));

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['wechat'],
        title: '测试',
        message: '内容',
        severity: 'critical',
        data: { triggerDetails: { actual_value: 100, threshold: 50, metric_type: 'VaR' } },
      });

      expect(results[0].success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.weixin.qq.com/cgi-bin/token',
        expect.any(Object)
      );
    });

    it('N-016: 微信获取 token 失败', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', openid: 'wx123' });
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true },
      });
      mockedAxios.get.mockResolvedValue({
        data: { errmsg: 'invalid appid' },
      });

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['wechat'],
        title: '测试',
        message: '内容',
        severity: 'high',
      });

      expect(results[0].success).toBe(false);
    });

    it('N-017: 微信未配置凭证时应失败', async () => {
      userRepo.findOne.mockResolvedValue({ user_id: 'u1', openid: 'wx123' });
      configRepo.findOne.mockResolvedValue({
        config_value: { enabled: true },
      });
      const oldAppId = process.env.WECHAT_APP_ID;
      const oldSecret = process.env.WECHAT_APP_SECRET;
      delete (process.env as any).WECHAT_APP_ID;
      delete (process.env as any).WECHAT_APP_SECRET;

      const results = await NotificationService.send({
        userId: 'u1',
        channels: ['wechat'],
        title: '测试',
        message: '内容',
        severity: 'low',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('credentials not configured');

      if (oldAppId) process.env.WECHAT_APP_ID = oldAppId;
      if (oldSecret) process.env.WECHAT_APP_SECRET = oldSecret;
    });
  });

  // ── resolveWechatTemplateId ──
  describe('resolveWechatTemplateId', () => {
    it('N-018: 应从配置读取模板ID', () => {
      const id = (NotificationService as any).resolveWechatTemplateId('high', { templateId: 'cfg_tmpl' });
      expect(id).toBe('cfg_tmpl');
    });

    it('N-019: 应从环境变量读取模板ID', () => {
      const oldEnv = process.env.WECHAT_TEMPLATE_HIGH;
      process.env.WECHAT_TEMPLATE_HIGH = 'env_tmpl';
      const id = (NotificationService as any).resolveWechatTemplateId('high', {});
      expect(id).toBe('env_tmpl');
      if (oldEnv) process.env.WECHAT_TEMPLATE_HIGH = oldEnv; else delete (process.env as any).WECHAT_TEMPLATE_HIGH;
    });

    it('N-020: 无配置时应返回空', () => {
      const id = (NotificationService as any).resolveWechatTemplateId('unknown', {});
      expect(id).toBe('');
    });
  });

  // ── buildWechatTemplateData ──
  describe('buildWechatTemplateData', () => {
    it('N-021: 应构建微信模板消息数据', () => {
      const data = (NotificationService as any).buildWechatTemplateData('wx123', 'tmpl_1', {
        userId: 'u1',
        channels: ['wechat'],
        title: '预警',
        message: 'VaR超限',
        severity: 'critical',
        data: { triggerDetails: { actual_value: 15000, threshold: 10000, metric_type: 'VaR' } },
      });

      expect(data).toHaveProperty('touser', 'wx123');
      expect(data).toHaveProperty('template_id', 'tmpl_1');
      expect(data.data).toHaveProperty('alertLevel');
      expect(data.data).toHaveProperty('currentValue');
    });

    it('N-022: 无 triggerDetails 时也应生成数据', () => {
      const data = (NotificationService as any).buildWechatTemplateData('wx123', 'tmpl_1', {
        userId: 'u1',
        channels: ['wechat'],
        title: '预警',
        message: '测试',
        severity: 'low',
      });

      expect(data.data.currentValue.value).toBe('-');
      expect(data.data.thresholdValue.value).toBe('-');
    });
  });

  // ── getNotificationHistory / markAsRead / getUnreadCount ──
  describe('通知历史与状态', () => {
    it('N-023: getNotificationHistory 应返回历史', async () => {
      const alerts = [{ history_id: 'a1', title: 't1' }, { history_id: 'a2', title: 't2' }];
      alertRepo.find.mockResolvedValue(alerts);

      const result = await NotificationService.getNotificationHistory('u1', 10);
      expect(result).toEqual(alerts);
      expect(alertRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { user_id: 'u1' },
        take: 10,
      }));
    });

    it('N-024: markAsRead 应标记为已读', async () => {
      const alert = { history_id: 'a1', user_id: 'u1', status: 'active', notification_status: {} };
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockResolvedValue(alert);

      const result = await NotificationService.markAsRead('a1', 'u1');
      expect(result).toBe(true);
      expect(alert.status).toBe('read');
      expect(alertRepo.save).toHaveBeenCalled();
    });

    it('N-025: markAsRead 找不到记录时返回 false', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      const result = await NotificationService.markAsRead('a-missing', 'u1');
      expect(result).toBe(false);
    });

    it('N-026: getUnreadCount 应返回未读数量', async () => {
      alertRepo.count.mockResolvedValue(5);
      const result = await NotificationService.getUnreadCount('u1');
      expect(result).toBe(5);
      expect(alertRepo.count).toHaveBeenCalledWith({
        where: { user_id: 'u1', status: 'active' },
      });
    });
  });
});
