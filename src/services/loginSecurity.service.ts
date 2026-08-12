/**
 * [PRME-TS-002] 登录安全服务
 * 文件: loginSecurity.service.ts
 * 需求描述: 等保二级-身份鉴别控制点优化：异常登录检测、登录历史记录
 * 最后更新: 2026-07-07
 */
import { AppDataSource } from '../config/database';
import { UserLoginHistory } from '../models/UserLoginHistory';
import { NotificationService } from './notification.service';
import logger from '../utils/logger';

const loginHistoryRepo = () => AppDataSource.getRepository(UserLoginHistory);

export interface LoginSecurityResult {
  risk_level: 'low' | 'medium' | 'high';
  anomalies: string[];
  shouldNotify: boolean;
}

export class LoginSecurityService {
  /**
   * 记录登录事件
   */
  static async recordLogin(params: {
    userId: string;
    loginType: 'password' | 'wechat' | 'refresh_token';
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    isSuccessful: boolean;
    failureReason?: string;
    sessionTokenJti?: string;
  }): Promise<void> {
    try {
      const record = loginHistoryRepo().create({
        user_id: params.userId,
        login_type: params.loginType,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        device_fingerprint: params.deviceFingerprint || null,
        is_successful: params.isSuccessful,
        failure_reason: params.failureReason || null,
        session_token_jti: params.sessionTokenJti || null,
      });
      await loginHistoryRepo().save(record);
    } catch (e: any) {
      logger.error('Failed to record login history', { error: e.message, userId: params.userId });
    }
  }

  /**
   * 检测异常登录行为
   */
  static async detectAnomalies(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }): Promise<LoginSecurityResult> {
    const anomalies: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    const recentHistory = await loginHistoryRepo().find({
      where: { user_id: params.userId },
      order: { created_at: 'DESC' },
      take: 50,
    });

    const successfulLogins = recentHistory.filter(h => h.is_successful);
    const failedLogins = recentHistory.filter(h => !h.is_successful);

    // 1. 检测短时间内大量失败登录（暴力破解）
    const recentFailures = failedLogins.filter(
      h => h.created_at > new Date(Date.now() - 15 * 60 * 1000)
    );
    if (recentFailures.length >= 5) {
      anomalies.push(`15分钟内登录失败${recentFailures.length}次，疑似暴力破解`);
      riskLevel = 'high';
    } else if (recentFailures.length >= 3) {
      anomalies.push(`15分钟内登录失败${recentFailures.length}次`);
      riskLevel = maxRiskLevel(riskLevel, 'medium');
    }

    // 2. 检测新设备/浏览器
    if (params.deviceFingerprint && successfulLogins.length > 0) {
      const knownDevices = new Set(successfulLogins.map(h => h.device_fingerprint).filter(Boolean));
      if (!knownDevices.has(params.deviceFingerprint)) {
        anomalies.push('检测到新设备登录');
        riskLevel = maxRiskLevel(riskLevel, 'medium');
      }
    }

    // 3. 检测异地登录（IP 变化）
    if (params.ipAddress && successfulLogins.length > 0) {
      const knownIps = new Set(successfulLogins.map(h => h.ip_address).filter(Boolean));
      if (!knownIps.has(params.ipAddress)) {
        anomalies.push(`检测到新IP地址登录: ${params.ipAddress}`);
        riskLevel = maxRiskLevel(riskLevel, 'medium');
      }
    }

    // 4. 检测短时间内多次登录（会话异常）
    const recentLogins = successfulLogins.filter(
      h => h.created_at > new Date(Date.now() - 60 * 60 * 1000)
    );
    if (recentLogins.length >= 10) {
      anomalies.push(`1小时内登录${recentLogins.length}次，会话行为异常`);
      riskLevel = 'high';
    }

    // 5. 检测非工作时间登录（可选）
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      anomalies.push('非工作时间登录');
      riskLevel = maxRiskLevel(riskLevel, 'medium');
    }

    return {
      risk_level: riskLevel,
      anomalies,
      shouldNotify: riskLevel === 'high' || anomalies.length >= 2,
    };
  }

  /**
   * 发送异常登录通知
   */
  static async sendSecurityAlert(userId: string, anomalies: string[]): Promise<void> {
    try {
      await NotificationService.send({
        userId,
        channels: ['app', 'email'],
        title: '异常登录安全提醒',
        message: `检测到异常登录行为：${anomalies.join('；')}`,
        severity: 'high',
        data: { alertType: 'login_anomaly', anomalies },
      });
      logger.info('Security alert sent', { userId, anomalyCount: anomalies.length });
    } catch (e: any) {
      logger.error('Failed to send security alert', { error: e.message, userId });
    }
  }

  /**
   * 获取用户登录历史
   */
  static async getLoginHistory(userId: string, options: { page?: number; limit?: number; days?: number } = {}) {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const days = options.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [records, total] = await loginHistoryRepo().findAndCount({
      where: { user_id: userId, created_at: since },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { records, total, page, limit };
  }

  /**
   * 获取用户活跃设备列表
   */
  static async getActiveDevices(userId: string): Promise<Array<{
    deviceFingerprint: string | null;
    lastLoginAt: Date;
    loginCount: number;
    lastIp: string | null;
  }>> {
    const history = await loginHistoryRepo().find({
      where: { user_id: userId, is_successful: true },
      order: { created_at: 'DESC' },
    });

    const deviceMap = new Map<string, { lastLoginAt: Date; count: number; lastIp: string | null }>();
    for (const record of history) {
      const fp = record.device_fingerprint || 'unknown';
      const existing = deviceMap.get(fp);
      if (!existing) {
        deviceMap.set(fp, { lastLoginAt: record.created_at, count: 1, lastIp: record.ip_address });
      } else {
        existing.count++;
        if (record.created_at > existing.lastLoginAt) {
          existing.lastLoginAt = record.created_at;
          existing.lastIp = record.ip_address;
        }
      }
    }

    return Array.from(deviceMap.entries()).map(([deviceFingerprint, data]) => ({
      deviceFingerprint,
      lastLoginAt: data.lastLoginAt,
      loginCount: data.count,
      lastIp: data.lastIp,
    }));
  }
}

// 辅助函数：比较风险等级
function maxRiskLevel(a: 'low' | 'medium' | 'high', b: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  const levels = { low: 0, medium: 1, high: 2 };
  return levels[a] >= levels[b] ? a : b;
}

export default LoginSecurityService;
