import { AppDataSource } from '../../src/config/database';
import { AuditService } from '../../src/services/audit.service';
import { AuditLog } from '../../src/models/AuditLog';
import { User } from '../../src/models/User';

describe('AuditService', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterEach(async () => {
    const logRepo = AppDataSource.getRepository(AuditLog);
    const userRepo = AppDataSource.getRepository(User);
    await logRepo.delete({ resource_type: 'test_resource' });
    await logRepo.delete({ operation_type: 'OPTIMIZE' });
    await userRepo.delete({ username: 'audit-test-user-1' });
    await userRepo.delete({ username: 'audit-test-user-2' });
    await userRepo.delete({ username: 'audit-test-user' });
    await userRepo.delete({ username: 'audit-test-user-default' });
  });

  it('should log operation with details', async () => {
    // 创建测试用户
    const userRepo = AppDataSource.getRepository(User);
    const testUser = userRepo.create({
      username: 'audit-test-user-1',
      email: 'audit-test-1@example.com',
      password_hash: 'test-hash',
    });
    await userRepo.save(testUser);

    await AuditService.log(
      'CREATE',
      'test_resource',
      'test-id-123',
      { test: true },
      { userId: testUser.user_id, ipAddress: '127.0.0.1', userAgent: 'test-agent' }
    );

    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({
      where: { resource_type: 'test_resource' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].operation_type).toBe('CREATE');
    expect(logs[0].details).toHaveProperty('test');
    expect(logs[0].ip_address).toBe('127.0.0.1');
    
    // 清理
    await logRepo.delete({ resource_type: 'test_resource' });
    await userRepo.delete({ user_id: testUser.user_id });
  });

  it('should log OPTIMIZE operation', async () => {
    // 创建测试用户
    const userRepo = AppDataSource.getRepository(User);
    const testUser = userRepo.create({
      username: 'audit-test-user-2',
      email: 'audit-test-2@example.com',
      password_hash: 'test-hash',
    });
    await userRepo.save(testUser);

    await AuditService.log(
      'OPTIMIZE',
      'optimization_results',
      'opt-id-456',
      { method: 'risk_parity', has_investment_keywords: false },
      { userId: testUser.user_id }
    );

    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({
      where: { operation_type: 'OPTIMIZE' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].details.method).toBe('risk_parity');
    
    // 清理
    await logRepo.delete({ operation_type: 'OPTIMIZE' });
    await userRepo.delete({ user_id: testUser.user_id });
  });

  it('should log with default details and context', async () => {
    await AuditService.log('CREATE', 'test_resource', 'test-id-default');

    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({
      where: { resource_id: 'test-id-default' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].user_id).toBeNull();
    expect(logs[0].ip_address).toBeNull();
    expect(logs[0].user_agent).toBeNull();

    await logRepo.delete({ resource_id: 'test-id-default' });
  });

  it('should handle log with partial context gracefully', async () => {
    // 先创建一个测试用户，避免外键约束
    const userRepo = AppDataSource.getRepository(User);
    const testUser = userRepo.create({
      username: 'audit-test-user',
      email: 'audit-test@example.com',
      password_hash: 'test-hash',
    });
    await userRepo.save(testUser);
    
    await AuditService.log('QUERY', 'test_resource', 'test-id-789', { query: 'test' }, { userId: testUser.user_id });
    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({
      where: { resource_id: 'test-id-789' },
    });
    expect(logs.length).toBe(1);
    
    // 清理
    await logRepo.delete({ resource_id: 'test-id-789' });
    await userRepo.delete({ user_id: testUser.user_id });
  });

  it('should log entity creation without explicit context', async () => {
    await AuditService.logCreate('test_resource', 'create-id', { field: 'value' });
    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({ where: { resource_id: 'create-id' } });
    expect(logs.length).toBe(1);
    expect(logs[0].operation_type).toBe('CREATE');
    await logRepo.delete({ resource_id: 'create-id' });
  });

  it('should log entity update without explicit context', async () => {
    await AuditService.logUpdate('test_resource', 'update-id', { old: 'a' }, { new: 'b' });
    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({ where: { resource_id: 'update-id' } });
    expect(logs.length).toBe(1);
    expect(logs[0].operation_type).toBe('UPDATE');
    await logRepo.delete({ resource_id: 'update-id' });
  });

  it('should log entity deletion without explicit context', async () => {
    await AuditService.logDelete('test_resource', 'delete-id', { old: 'a' });
    const logRepo = AppDataSource.getRepository(AuditLog);
    const logs = await logRepo.find({ where: { resource_id: 'delete-id' } });
    expect(logs.length).toBe(1);
    expect(logs[0].operation_type).toBe('DELETE');
    await logRepo.delete({ resource_id: 'delete-id' });
  });

  it('should query audit logs with all filters', async () => {
    const userRepo = AppDataSource.getRepository(User);
    const testUser = userRepo.create({
      username: 'audit-query-user',
      email: 'audit-query@example.com',
      password_hash: 'test-hash',
    });
    await userRepo.save(testUser);

    await AuditService.log('QUERY', 'query_resource', 'q1', { a: 1 }, { userId: testUser.user_id });
    await AuditService.log('CREATE', 'query_resource', 'q2', { a: 2 }, { userId: testUser.user_id });

    const result = await AuditService.queryLogs({
      user_id: testUser.user_id,
      operation_type: 'QUERY',
      resource_type: 'query_resource',
      start_date: new Date(Date.now() - 86400000).toISOString(),
      end_date: new Date(Date.now() + 86400000).toISOString(),
      page: 1,
      limit: 10,
    });

    expect(result.logs.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should query audit logs with no params and use defaults', async () => {
    const result = await AuditService.queryLogs({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(Array.isArray(result.logs)).toBe(true);
  });

  it('should clamp page and limit', async () => {
    const result = await AuditService.queryLogs({ page: 0, limit: 200 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it('should not throw when database save fails', async () => {
    const mockRepo = {
      create: jest.fn().mockReturnValue({ log_id: 'l1' }),
      save: jest.fn().mockRejectedValue(new Error('DB error')),
    };
    jest.spyOn(AppDataSource, 'getRepository').mockImplementation((entity: any) => {
      if (entity?.name === 'AuditLog' || entity === 'AuditLog') {
        return mockRepo as any;
      }
      return AppDataSource.getRepository(entity);
    });

    await expect(
      AuditService.log('CREATE', 'test_resource', 'test-id', {}, {})
    ).resolves.not.toThrow();

    jest.restoreAllMocks();
  });
});
