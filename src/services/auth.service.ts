/**
 * [PRME-TS-002] 用户设置
 * 文件: auth.service.ts
 * 需求描述: 用户设置功能实现 — JWT 无状态 + SQLite 黑名单
 * 关联: arc v1.2 架构设计 §3.3.1
 * 最后更新: 2026-06-14
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { UserSession } from '../models/UserSession';
import { RefreshTokenBlacklist } from '../models/RefreshTokenBlacklist';
import { LoginSecurityService } from './loginSecurity.service';
import { JWT_CONFIG } from '../config/jwt';
import { encrypt } from '../utils/encryption';
import { escapeHtml, validateEmail, sanitizeUserResponse } from '../utils/sanitize';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const WECHAT_API = 'https://api.weixin.qq.com';
const WECHAT_APPID = process.env.WECHAT_APPID || process.env.WECHAT_APP_ID || '';
const WECHAT_SECRET = process.env.WECHAT_APPSECRET || process.env.WECHAT_APP_SECRET || '';

// 密码策略配置
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
};

const userRepo = () => AppDataSource.getRepository(User);
const sessionRepo = () => AppDataSource.getRepository(UserSession);
const blacklistRepo = () => AppDataSource.getRepository(RefreshTokenBlacklist);

export class AuthService {
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!password || password.length < PASSWORD_POLICY.minLength) {
      errors.push(`密码长度至少${PASSWORD_POLICY.minLength}位`);
    }
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    }
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    }
    if (PASSWORD_POLICY.requireDigit && !/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    }
    if (PASSWORD_POLICY.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密码必须包含至少一个特殊字符');
    }
    return { valid: errors.length === 0, errors };
  }

  static async register(data: { username: string; email?: string; phone?: string; password: string }) {
    // BUG-003 修复：验证 email 格式，拒绝包含 HTML 标签的输入
    if (data.email) {
      const emailCheck = validateEmail(data.email);
      if (!emailCheck.valid) {
        throw new ValidationError(emailCheck.error || 'Invalid email');
      }
    }

    const pwdCheck = this.validatePassword(data.password);
    if (!pwdCheck.valid) {
      throw new ValidationError('密码不符合安全策略: ' + pwdCheck.errors.join('; '));
    }

    const existing = await userRepo().findOne({
      where: [{ username: data.username }, { email: data.email || '' }, { phone: data.phone || '' }],
    });
    if (existing) {
      throw new ValidationError('User already exists');
    }
    const hash = await bcrypt.hash(data.password, 12);
    const user = userRepo().create({
      username: data.username,
      email: data.email || null,
      phone: data.phone || null,
      password_hash: hash,
      first_risk_acknowledged: false, // ✅ 默认未确认，用户需主动确认
    });
    await userRepo().save(user);

    // 移除：不再自动授予 consent，需用户主动勾选（UAT CMP-002 修复）

    // BUG-003 修复：generateTokens 内部已做 HTML 转义
    return this.generateTokens(user);
  }

  static async login(username: string, password: string, ipAddress: string = '', userAgent: string = '') {
    const user = await userRepo().findOne({
      where: [{ username }, { email: username }, { phone: username }],
    });
    if (!user || !user.password_hash) throw new ValidationError('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // 记录失败登录
      await LoginSecurityService.recordLogin({
        userId: user.user_id,
        loginType: 'password',
        ipAddress,
        userAgent,
        isSuccessful: false,
        failureReason: 'Invalid password',
      });
      throw new ValidationError('Invalid credentials');
    }
    user.last_login = new Date();
    user.login_count += 1;
    await userRepo().save(user);

    // 记录成功登录并进行安全检测
    const loginRecord = {
      userId: user.user_id,
      loginType: 'password' as const,
      ipAddress,
      userAgent,
      isSuccessful: true,
      sessionTokenJti: '',
    };
    await LoginSecurityService.recordLogin(loginRecord);

    // 异常登录检测
    const securityCheck = await LoginSecurityService.detectAnomalies({
      userId: user.user_id,
      ipAddress: loginRecord.ipAddress,
      userAgent: loginRecord.userAgent,
    });
    if (securityCheck.shouldNotify) {
      await LoginSecurityService.sendSecurityAlert(user.user_id, securityCheck.anomalies);
    }
    return this.generateTokens(user);
  }

  static async logout(token: string) {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded?.jti) {
        logger.warn('Logout: token missing jti, cannot blacklist');
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const blacklist = blacklistRepo().create({
        token_jti: decoded.jti,
        user_id: decoded.user_id,
        revoked_at: now,
        expires_at: decoded.exp || now + 86400,
        reason: 'logout',
      });
      await blacklistRepo().save(blacklist);
      logger.info('Token blacklisted', { jti: decoded.jti, user_id: decoded.user_id });
    } catch (err) {
      logger.error('Logout blacklist failed', { error: (err as Error).message });
    }
  }

  static async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, JWT_CONFIG.secret) as any;
      
      // 检查 Refresh Token 是否在黑名单中
      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }
      
      const user = await userRepo().findOne({ where: { user_id: payload.user_id } });
      if (!user) throw new Error('User not found');
      return this.generateTokens(user);
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  private static generateTokens(user: User) {
    // BUG-003 修复：对返回给客户端的用户字段进行 HTML 实体编码，防止 XSS
    const safeUser = sanitizeUserResponse({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
    const payload = { user_id: safeUser.user_id, username: safeUser.username, email: safeUser.email, role: safeUser.role };
    const jti = uuidv4();
    const token = jwt.sign({ ...payload, jti }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const refreshToken = jwt.sign({ user_id: user.user_id, role: user.role, jti: uuidv4() }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.refreshExpiresIn as any });
    return { token, refreshToken, user: payload };
  }

  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded?.jti) return false;
      
      const exists = await blacklistRepo().findOne({ where: { token_jti: decoded.jti } });
      return !!exists;
    } catch (err) {
      logger.warn('Token blacklist check failed', { error: (err as Error).message });
      return false;
    }
  }

  /**
   * 清理过期黑名单条目（建议每日凌晨执行）
   */
  static async cleanupExpiredBlacklist(): Promise<number> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await AppDataSource
        .createQueryBuilder()
        .delete()
        .from(RefreshTokenBlacklist)
        .where('expires_at < :now', { now })
        .execute();
      const deleted = result.affected || 0;
      if (deleted > 0) {
        logger.info('Expired blacklist cleaned', { deleted });
      }
      return deleted;
    } catch (err) {
      logger.error('Blacklist cleanup failed', { error: (err as Error).message });
      return 0;
    }
  }

  /**
   * 微信小程序登录
   */
  static async wechatLogin(code: string, userInfo?: any) {
    if (!WECHAT_APPID || !WECHAT_SECRET) {
      throw new Error('Server not configured with WeChat AppID or AppSecret');
    }

    const wxRes = await axios.get(`${WECHAT_API}/sns/jscode2session`, {
      params: {
        appid: WECHAT_APPID,
        secret: WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code',
      },
    });

    if (wxRes.data.errcode) {
      throw new Error(`WeChat API error: ${wxRes.data.errmsg} (code: ${wxRes.data.errcode})`);
    }

    const { openid, session_key, unionid } = wxRes.data;
    logger.info('WeChat login success', { openid: openid.substring(0, 8) + '...' });

    let user = await userRepo().findOne({
      where: { wechat_info: { openid } },
    });

    if (!user) {
      const username = `wx_${openid.substring(0, 12)}`;
      user = userRepo().create({
        username,
        email: null,
        phone: null,
        password_hash: null,
        avatar_url: userInfo?.avatarUrl || null,
        wechat_info: {
          openid,
          unionid: unionid || null,
          session_key: encrypt(session_key),
          nickName: userInfo?.nickName || null,
          avatarUrl: userInfo?.avatarUrl || null,
          gender: userInfo?.gender || 0,
          country: userInfo?.country || null,
          province: userInfo?.province || null,
          city: userInfo?.city || null,
          language: userInfo?.language || null,
        },
        metadata: { source: 'wechat_miniprogram' },
      });
      await userRepo().save(user);
      logger.info('New WeChat user created', { user_id: user.user_id });
    } else {
      user.wechat_info = {
        ...user.wechat_info,
        openid,
        unionid: unionid || user.wechat_info?.unionid,
        session_key: encrypt(session_key),
        nickName: userInfo?.nickName || user.wechat_info?.nickName,
        avatarUrl: userInfo?.avatarUrl || user.wechat_info?.avatarUrl,
        gender: userInfo?.gender || user.wechat_info?.gender || 0,
        country: userInfo?.country || user.wechat_info?.country,
        province: userInfo?.province || user.wechat_info?.province,
        city: userInfo?.city || user.wechat_info?.city,
        language: userInfo?.language || user.wechat_info?.language,
      };
      if (userInfo?.avatarUrl) user.avatar_url = userInfo.avatarUrl;
      await userRepo().save(user);
    }

    user.last_login = new Date();
    user.login_count += 1;
    await userRepo().save(user);

    return this.generateTokens(user);
  }

  /**
   * 更新微信用户信息
   */
  static async updateWechatUser(userId: string, userInfo: any) {
    const user = await userRepo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');

    user.wechat_info = {
      ...user.wechat_info,
      nickName: userInfo.nickName || user.wechat_info?.nickName,
      avatarUrl: userInfo.avatarUrl || user.wechat_info?.avatarUrl,
      gender: userInfo.gender !== undefined ? userInfo.gender : user.wechat_info?.gender,
      country: userInfo.country || user.wechat_info?.country,
      province: userInfo.province || user.wechat_info?.province,
      city: userInfo.city || user.wechat_info?.city,
      language: userInfo.language || user.wechat_info?.language,
    };

    if (userInfo.avatarUrl) user.avatar_url = userInfo.avatarUrl;
    await userRepo().save(user);

    return {
      user_id: user.user_id,
      username: user.username,
      avatar_url: user.avatar_url,
      wechat_info: user.wechat_info,
    };
  }
}
