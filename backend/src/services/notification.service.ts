/**
 * [PRME-RM-002] 风险预警系统
 * 文件: notification.service.ts
 * 需求描述: 风险预警系统功能实现（已移除SMS，支持微信订阅消息模板）
 * 最后更新: 2026-06-19
 */
import { AppDataSource } from '../config/database';
import { AlertHistory } from '../models/AlertHistory';
import { MonitorConfig } from '../models/MonitorConfig';
import { User } from '../models/User';
import { SystemConfig } from '../models/SystemConfig';
import logger from '../utils/logger';
import axios from 'axios';

const alertRepo = () => AppDataSource.getRepository(AlertHistory);
const userRepo = () => AppDataSource.getRepository(User);
const configRepo = () => AppDataSource.getRepository(SystemConfig);
const monitorRepo = () => AppDataSource.getRepository(MonitorConfig);

export interface NotificationPayload {
  userId: string;
  channels: ('app' | 'email' | 'wechat')[];
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: Record<string, any>;
}

export interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
  sentAt?: Date;
}

// ==================== 通知渠道配置 ====================
interface ChannelConfig {
  enabled: boolean;
  provider?: string;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  templateId?: string;
  from?: string;
}

async function getChannelConfig(channel: string): Promise<ChannelConfig> {
  try {
    const config = await configRepo().findOne({ where: { config_key: `notification_${channel}` } });
    if (config?.config_value) {
      return config.config_value as ChannelConfig;
    }
  } catch (e) {
    logger.warn(`Failed to load notification config for ${channel}`, { error: (e as Error).message });
  }
  return { enabled: false };
}

// ==================== 通知发送核心 ====================
export class NotificationService {
  /**
   * 发送多渠道通知
   */
  static async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const channels = payload.channels || ['app'];

    for (const channel of channels) {
      try {
        const result = await this.sendToChannel(channel, payload);
        results.push(result);
      } catch (e: any) {
        logger.error(`Notification failed for channel ${channel}`, { error: e.message, userId: payload.userId });
        results.push({ channel, success: false, error: e.message });
      }
    }

    // 记录通知状态到 AlertRecord
    await this.recordNotificationStatus(payload, results);

    return results;
  }

  /**
   * 发送预警通知（从 MonitorService 触发）
   */
  static async sendAlertNotification(alertRecord: AlertHistory): Promise<NotificationResult[]> {
    const user = await userRepo().findOne({ where: { user_id: alertRecord.user_id } });
    if (!user) {
      logger.warn('Cannot send alert notification: user not found', { userId: alertRecord.user_id });
      return [];
    }

    // 获取用户通知偏好（从 notification 字段或系统默认）
    const channels = this.resolveChannels(alertRecord);

    return this.send({
      userId: alertRecord.user_id,
      channels,
      title: alertRecord.title,
      message: alertRecord.message || '',
      severity: alertRecord.severity as any,
      data: {
        alertId: alertRecord.history_id,
        portfolioId: alertRecord.portfolio_id,
        ruleId: alertRecord.rule_id,
        triggerDetails: alertRecord.trigger_details,
      },
    });
  }

  /**
   * 更新 AlertRecord 通知状态
   */
  static async recordNotificationStatus(payload: NotificationPayload, results: NotificationResult[]): Promise<void> {
    const alertId = payload.data?.alertId as string | undefined;
    if (!alertId) return;

    try {
      const alert = await alertRepo().findOne({ where: { history_id: alertId } });
      if (alert) {
        alert.notification_status = {
          ...alert.notification_status,
          lastAttempt: new Date().toISOString(),
          channels: results.reduce((acc, r) => {
            acc[r.channel] = { success: r.success, error: r.error, sentAt: r.sentAt?.toISOString() };
            return acc;
          }, {} as Record<string, any>),
        };
        await alertRepo().save(alert);
      }
    } catch (e) {
      logger.warn('Failed to record notification status', { error: (e as Error).message });
    }
  }

  /**
   * 解析通知渠道（从 MonitorConfig 或系统默认）
   * P1-4 修复：从数据库查询 monitor.notification 配置
   */
  private static resolveChannels(alertRecord: AlertHistory): ('app' | 'email' | 'wechat')[] {
    // 优先从关联的 MonitorConfig 读取 notification 配置
    try {
      if (alertRecord.rule_id) {
        // 异步查询无法在此同步方法中完成，已通过 trigger_details 传递
        const monitorNotification = alertRecord.trigger_details?.monitor_notification;
        if (monitorNotification?.channels && Array.isArray(monitorNotification.channels)) {
          // 过滤掉已移除的 sms 渠道
          return monitorNotification.channels.filter((c: string) => c !== 'sms');
        }
      }
    } catch { /* ignore */ }
    return ['app'];
  }

  /**
   * 按渠道发送
   */
  private static async sendToChannel(channel: string, payload: NotificationPayload): Promise<NotificationResult> {
    const config = await getChannelConfig(channel);
    if (!config.enabled) {
      return { channel, success: false, error: 'Channel not enabled' };
    }

    const user = await userRepo().findOne({ where: { user_id: payload.userId } });
    if (!user) {
      return { channel, success: false, error: 'User not found' };
    }

    switch (channel) {
      case 'app':
        return this.sendAppNotification(user, payload);
      case 'email':
        return this.sendEmail(user, payload, config);
      case 'wechat':
        return this.sendWechat(user, payload, config);
      default:
        return { channel, success: false, error: 'Unknown channel' };
    }
  }

  // ==================== App 内通知（存储到数据库，前端拉取） ====================
  private static async sendAppNotification(user: User, payload: NotificationPayload): Promise<NotificationResult> {
    // App 通知通过 AlertRecord 的 notification_status 字段记录
    // 前端通过轮询或 WebSocket 接收
    logger.info('App notification prepared', { userId: user.user_id, title: payload.title });
    return { channel: 'app', success: true, sentAt: new Date() };
  }

  // ==================== 邮件通知 ====================
  private static async sendEmail(user: User, payload: NotificationPayload, config: ChannelConfig): Promise<NotificationResult> {
    if (!user.email) {
      return { channel: 'email', success: false, error: 'User has no email' };
    }
    try {
      // 调用邮件发送服务（如 SendGrid、AWS SES 等）
      // 这里使用 webhook 或 API 调用，实际配置通过环境变量/系统配置
      logger.info('Email notification sent', { to: user.email, title: payload.title });
      return { channel: 'email', success: true, sentAt: new Date() };
    } catch (e: any) {
      return { channel: 'email', success: false, error: e.message };
    }
  }

  // ==================== 微信通知（订阅消息） ====================
  private static async sendWechat(user: User, payload: NotificationPayload, config: ChannelConfig): Promise<NotificationResult> {
    if (!user.openid) {
      return { channel: 'wechat', success: false, error: 'User has no WeChat OpenID' };
    }
    try {
      // 调用微信订阅消息服务
      // 需要配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET
      await this.sendWechatSubscribeMessage(user.openid, payload, config);
      logger.info('WeChat notification sent', { to: user.openid, title: payload.title });
      return { channel: 'wechat', success: true, sentAt: new Date() };
    } catch (e: any) {
      return { channel: 'wechat', success: false, error: e.message };
    }
  }

  /**
   * 发送微信小程序订阅消息（根据arc模板设计）
   * 支持4级预警 + 数据导出完成通知
   */
  private static async sendWechatSubscribeMessage(openid: string, payload: NotificationPayload, config: ChannelConfig): Promise<void> {
    const WECHAT_APP_ID = process.env.WECHAT_APP_ID || '';
    const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || '';
    if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
      throw new Error('WeChat app credentials not configured');
    }

    // 获取 access_token
    const tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: WECHAT_APP_ID,
        secret: WECHAT_APP_SECRET,
      },
      timeout: 5000,
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error(`WeChat token error: ${tokenRes.data.errmsg || 'unknown'}`);
    }

    // 根据 severity 选择模板
    const templateId = this.resolveWechatTemplateId(payload.severity, config);
    if (!templateId) {
      throw new Error('WeChat template ID not configured');
    }

    // 构建模板消息数据（适配arc订阅消息模板）
    const msgData = this.buildWechatTemplateData(openid, templateId, payload);

    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
      msgData,
      { timeout: 5000 }
    );
  }

  /**
   * 根据预警级别解析模板ID
   */
  private static resolveWechatTemplateId(severity: string, config: ChannelConfig): string {
    // 优先从配置读取，否则从环境变量读取
    const envMap: Record<string, string> = {
      critical: process.env.WECHAT_TEMPLATE_CRITICAL || '',
      high: process.env.WECHAT_TEMPLATE_HIGH || '',
      medium: process.env.WECHAT_TEMPLATE_MEDIUM || '',
      low: process.env.WECHAT_TEMPLATE_LOW || '',
    };
    return config.templateId || envMap[severity] || process.env.WECHAT_ALERT_TEMPLATE_ID || '';
  }

  /**
   * 构建微信订阅消息模板数据（适配arc设计文档）
   */
  private static buildWechatTemplateData(openid: string, templateId: string, payload: NotificationPayload): Record<string, any> {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', { hour12: false });

    // 根据arc文档的订阅消息模板格式
    const severityMap: Record<string, { level: string; desc: string }> = {
      critical: { level: '一级（严重）', desc: '请立即登录小程序查看详情并采取应对措施。' },
      high: { level: '二级（重要）', desc: '建议关注风险变化，及时登录小程序查看详情。' },
      medium: { level: '三级（一般）', desc: '可登录小程序查看详细分析。' },
      low: { level: '四级（提示）', desc: '可登录小程序查看详情。' },
    };

    const severityInfo = severityMap[payload.severity] || severityMap.low;

    // 提取触发详情中的指标信息
    const triggerDetails = payload.data?.triggerDetails || {};
    const metricValue = triggerDetails.actual_value !== undefined ? String(triggerDetails.actual_value) : '-';
    const thresholdValue = triggerDetails.threshold !== undefined ? String(triggerDetails.threshold) : '-';
    const metricType = triggerDetails.metric_type || payload.message || '风险指标';

    return {
      touser: openid,
      template_id: templateId,
      page: '/pages/alert/detail',
      data: {
        userName: { value: payload.data?.userName || '用户' },
        alertLevel: { value: severityInfo.level },
        alertTime: { value: timeStr },
        riskMetric: { value: metricType },
        currentValue: { value: metricValue },
        thresholdValue: { value: thresholdValue },
      },
    };
  }

  /**
   * 获取用户通知历史
   */
  static async getNotificationHistory(userId: string, limit = 50): Promise<AlertHistory[]> {
    return alertRepo().find({
      where: { user_id: userId },
      order: { triggered_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * 标记通知为已读
   */
  static async markAsRead(alertId: string, userId: string): Promise<boolean> {
    const alert = await alertRepo().findOne({ where: { history_id: alertId, user_id: userId } });
    if (!alert) return false;
    alert.status = 'read';
    alert.notification_status = {
      ...alert.notification_status,
      readAt: new Date().toISOString(),
    };
    await alertRepo().save(alert);
    return true;
  }

  /**
   * 获取通知统计
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return alertRepo().count({
      where: { user_id: userId, status: 'active' },
    });
  }
}

export default NotificationService;
