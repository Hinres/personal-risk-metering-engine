/**
 * [PRME-INFRA-006] 基础设施 - 加密工具
 * [T-22] 文件: encryption.ts
 * 需求描述: AES-256-GCM 加解密，移除不安全的 CBC 向后兼容
 * 最后更新: 2026-06-19
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('FATAL: ENCRYPTION_KEY environment variable is required');
}
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateRandomToken = (length = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const generateOrderNo = (): string => {
  const prefix = 'ORD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * 加密（AES-256-GCM，随机 salt + 随机 IV）
 * 格式: salt:iv:authTag:encrypted
 */
export const encrypt = (text: string): string => {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag + ':' + encrypted;
};

/**
 * 解密（AES-256-GCM）
 * 支持格式:
 *   - v2: salt:iv:authTag:encrypted (4 parts, 随机 salt)
 *   - v1: iv:authTag:encrypted (3 parts, 固定 salt 'salt')
 * 不支持:
 *   - v0: iv:encrypted (2 parts, CBC 模式) — 已移除，遇到会抛出 MIGRATION_REQUIRED 错误
 */
export const decrypt = (encryptedText: string): string => {
  const parts = encryptedText.split(':');

  // T-22: 移除 CBC 向后兼容
  if (parts.length === 2) {
    throw new Error(
      'MIGRATION_REQUIRED: Detected legacy CBC-encrypted data. ' +
      'This data was encrypted with an insecure algorithm and must be re-encrypted. ' +
      'Please migrate the data using the encryption migration script.'
    );
  }

  if (parts.length === 3) {
    // v1 格式: iv:authTag:encrypted (固定 salt)
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (parts.length === 4) {
    // v2 格式: salt:iv:authTag:encrypted (随机 salt)
    const [saltHex, ivHex, authTagHex, encrypted] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  throw new Error('Invalid encrypted text format');
};

/**
 * 检测是否为旧版 CBC 加密数据
 */
export const isLegacyCbcData = (encryptedText: string): boolean => {
  return encryptedText.split(':').length === 2;
};

/**
 * 检测是否需要迁移（v0 CBC 或 v1 固定 salt）
 */
export const needsMigration = (encryptedText: string): boolean => {
  const parts = encryptedText.split(':');
  return parts.length === 2 || parts.length === 3; // v0 CBC 或 v1 固定 salt
};
