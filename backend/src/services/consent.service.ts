/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: consent.service.ts
 * 需求描述: 审计与合规功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { UserConsent } from '../models/UserConsent';
import { User } from '../models/User';
import logger from '../utils/logger';
import { createHash } from 'crypto';

const consentRepo = () => AppDataSource.getRepository(UserConsent);
const userRepo = () => AppDataSource.getRepository(User);

// 同意书内容版本（实际生产环境应存储在数据库或配置中心）
const CONSENT_TEXTS: Record<string, { version: string; text: string }> = {
  data_collection: {
    version: '1.0',
    text: '我们收集您的投资组合数据、风险计算结果用于提供风险评估服务。',
  },
  optimization_advice: {
    version: '1.0',
    text: '我们使用您的组合数据生成优化建议，该建议不构成投资建议。',
  },
  marketing: {
    version: '1.0',
    text: '我们可能在获得您同意的情况下向您推送产品更新和营销信息。',
  },
};

function hashConsentText(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 64);
}

export class ConsentService {
  static async recordConsent(userId: string, consentType: string, grantedVia: string, ipAddress?: string) {
    const consentConfig = CONSENT_TEXTS[consentType];
    if (!consentConfig) {
      throw new Error(`Unknown consent type: ${consentType}`);
    }

    const textHash = hashConsentText(consentConfig.text);

    // 检查是否已存在有效同意
    const existing = await consentRepo().findOne({
      where: { user_id: userId, consent_type: consentType, is_active: true },
      order: { granted_at: 'DESC' },
    });

    if (existing && existing.consent_text_hash === textHash) {
      return { consent_id: existing.consent_id, status: 'already_granted', granted_at: existing.granted_at };
    }

    // 如果版本变化，撤销旧版本
    if (existing) {
      existing.is_active = false;
      existing.revoked_at = new Date();
      existing.revoked_reason = 'version_updated';
      await consentRepo().save(existing);
    }

    const consent = consentRepo().create({
      user_id: userId,
      consent_type: consentType,
      consent_version: consentConfig.version,
      consent_text_hash: textHash,
      granted_at: new Date(),
      granted_via: grantedVia,
      ip_address: ipAddress || null,
      is_active: true,
    });

    await consentRepo().save(consent);
    logger.info('Consent recorded', { userId: userId.substring(0, 8), consentType, version: consentConfig.version });

    return { consent_id: consent.consent_id, status: 'granted', granted_at: consent.granted_at };
  }

  static async revokeConsent(userId: string, consentType: string, reason?: string) {
    const consent = await consentRepo().findOne({
      where: { user_id: userId, consent_type: consentType, is_active: true },
      order: { granted_at: 'DESC' },
    });

    if (!consent) {
      throw new Error('Consent not found or already revoked');
    }

    consent.is_active = false;
    consent.revoked_at = new Date();
    consent.revoked_reason = reason || 'user_revoked';
    await consentRepo().save(consent);

    logger.info('Consent revoked', { userId: userId.substring(0, 8), consentType, reason });
    return { consent_type: consentType, revoked_at: consent.revoked_at, is_active: false };
  }

  static async getConsents(userId: string) {
    const consents = await consentRepo().find({
      where: { user_id: userId },
      order: { granted_at: 'DESC' },
    });

    return consents.map(c => ({
      consent_type: c.consent_type,
      consent_version: c.consent_version,
      is_active: c.is_active,
      granted_at: c.granted_at,
      revoked_at: c.revoked_at,
      granted_via: c.granted_via,
    }));
  }

  static async checkConsent(userId: string, consentType: string): Promise<boolean> {
    const consent = await consentRepo().findOne({
      where: { user_id: userId, consent_type: consentType, is_active: true },
    });
    return !!consent;
  }
}
