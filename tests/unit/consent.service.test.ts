import { AppDataSource } from '../../src/config/database';
import { ConsentService } from '../../src/services/consent.service';
import { User } from '../../src/models/User';
import { UserConsent } from '../../src/models/UserConsent';

describe('ConsentService', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    // 创建测试用户
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      username: 'test-consent-user',
      email: 'test-consent@test.com',
    });
    await userRepo.save(user);
    userId = user.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const consentRepo = AppDataSource.getRepository(UserConsent);
    await consentRepo.delete({ user_id: userId });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(async () => {
    const consentRepo = AppDataSource.getRepository(UserConsent);
    await consentRepo.delete({ user_id: userId });
  });

  it('should record new consent', async () => {
    const result = await ConsentService.recordConsent(userId, 'optimization_advice', 'api', '127.0.0.1');
    expect(result).toHaveProperty('consent_id');
    expect(result.status).toBe('granted');
  });

  it('should check consent exists', async () => {
    await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    const hasConsent = await ConsentService.checkConsent(userId, 'optimization_advice');
    expect(hasConsent).toBe(true);
  });

  it('should check consent not exists', async () => {
    const hasConsent = await ConsentService.checkConsent(userId, 'data_collection');
    expect(hasConsent).toBe(false);
  });

  it('should revoke consent', async () => {
    await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    const result = await ConsentService.revokeConsent(userId, 'optimization_advice', 'no longer needed');
    expect(result.is_active).toBe(false);

    const hasConsent = await ConsentService.checkConsent(userId, 'optimization_advice');
    expect(hasConsent).toBe(false);
  });

  it('should get consents list', async () => {
    await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    await ConsentService.recordConsent(userId, 'data_collection', 'api');
    const consents = await ConsentService.getConsents(userId);
    expect(consents.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject unknown consent type', async () => {
    await expect(
      ConsentService.recordConsent(userId, 'unknown_type', 'api')
    ).rejects.toThrow('Unknown consent type');
  });

  it('should update consent on version change', async () => {
    const first = await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    expect(first.status).toBe('granted');
    // Simulate version change by manually updating the hash
    const consentRepo = AppDataSource.getRepository(UserConsent);
    const existing = await consentRepo.findOne({ where: { user_id: userId, consent_type: 'optimization_advice' } });
    if (existing) {
      existing.consent_text_hash = 'old_hash';
      await consentRepo.save(existing);
    }
    const second = await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    expect(second.status).toBe('granted');
  });

  it('should throw when revoking non-existent consent', async () => {
    await expect(
      ConsentService.revokeConsent(userId, 'data_collection')
    ).rejects.toThrow('Consent not found or already revoked');
  });

  it('should record consent without ip address', async () => {
    const result = await ConsentService.recordConsent(userId, 'data_collection', 'api');
    expect(result.status).toBe('granted');
  });

  it('should return already_granted when consent hash unchanged', async () => {
    await ConsentService.recordConsent(userId, 'data_collection', 'api');
    const second = await ConsentService.recordConsent(userId, 'data_collection', 'api');
    expect(second.status).toBe('already_granted');
  });

  it('should revoke consent with default reason', async () => {
    await ConsentService.recordConsent(userId, 'optimization_advice', 'api');
    const result = await ConsentService.revokeConsent(userId, 'optimization_advice');
    expect(result.is_active).toBe(false);
  });
});
