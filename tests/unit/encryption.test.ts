import { encrypt, decrypt, isLegacyCbcData, needsMigration, hashPassword, comparePassword, generateRandomToken, generateOrderNo } from '../../src/utils/encryption';

describe('T-22 AES-256-GCM Encryption', () => {
  describe('TC-ENC.1: Encrypt and decrypt round-trip', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plainText = 'Hello, World! 测试中文';
      const encrypted = encrypt(plainText);
      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(4); // v2: salt:iv:authTag:encrypted

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });
  });

  describe('TC-ENC.2: Different texts produce different ciphertexts', () => {
    it('should produce different encrypted outputs for same plaintext', () => {
      const plainText = 'same text';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('TC-ENC.3: Legacy CBC data detection', () => {
    it('should detect legacy CBC format (2 parts)', () => {
      const legacyCbc = 'aabbccdd:' + '1122334455667788';
      expect(isLegacyCbcData(legacyCbc)).toBe(true);
      expect(needsMigration(legacyCbc)).toBe(true);
    });

    it('should throw MIGRATION_REQUIRED for legacy CBC data', () => {
      const legacyCbc = 'aabbccdd11223344:' + '11223344556677889900aabbccdd';
      expect(() => decrypt(legacyCbc)).toThrow('MIGRATION_REQUIRED');
    });
  });

  describe('TC-ENC.4: v1 GCM data still decryptable', () => {
    it('should decrypt v1 format (3 parts: iv:authTag:encrypted)', () => {
      // v1 uses fixed salt 'salt'
      const plainText = 'test v1 data';
      // Manually create v1 format
      const iv = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
      const key = require('crypto').scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
      const cipher = require('crypto').createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      const v1Format = iv.toString('hex') + ':' + authTag + ':' + encrypted;

      const decrypted = decrypt(v1Format);
      expect(decrypted).toBe(plainText);
      expect(needsMigration(v1Format)).toBe(true); // v1 needs migration to v2
    });
  });

  describe('TC-ENC.5: v2 format uses random salt', () => {
    it('should produce v2 format with random salt', () => {
      const plainText = 'test';
      const encrypted = encrypt(plainText);
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toHaveLength(32); // salt hex (16 bytes = 32 hex chars)
      expect(parts[1]).toHaveLength(32); // iv hex
      expect(parts[2]).toHaveLength(32); // authTag hex (16 bytes = 32 hex chars)
      expect(needsMigration(encrypted)).toBe(false);
    });
  });

  describe('TC-ENC.7: Invalid format handling', () => {
    it('should throw error for invalid format (1 part)', () => {
      expect(() => decrypt('onlyonepart')).toThrow('Invalid encrypted text format');
    });

    it('should throw error for invalid format (5 parts)', () => {
      expect(() => decrypt('a:b:c:d:e')).toThrow('Invalid encrypted text format');
    });
  });

  describe('TC-ENC.8: hashPassword and comparePassword', () => {
    it('should hash and compare password correctly', async () => {
      const password = 'test123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      const match = await comparePassword(password, hash);
      expect(match).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const password = 'test123';
      const hash = await hashPassword(password);
      const match = await comparePassword('wrong', hash);
      expect(match).toBe(false);
    });
  });

  describe('TC-ENC.9: generateRandomToken', () => {
    it('should generate token of specified length', () => {
      const token = generateRandomToken(16);
      expect(token).toHaveLength(32); // hex string = 2 * bytes
    });

    it('should generate token with default length', () => {
      const token = generateRandomToken();
      expect(token).toHaveLength(64); // default 32 bytes = 64 hex chars
    });
  });

  describe('TC-ENC.10: generateOrderNo', () => {
    it('should generate order number', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(/^ORD[A-Z0-9]+$/);
    });
  });
});
