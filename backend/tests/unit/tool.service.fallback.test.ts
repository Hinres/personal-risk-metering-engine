/**
 * [PRME-TS-001] ToolService fallback 分支补充测试
 * 范围: 触发 calculation engine 异常，覆盖 fallback 计算路径
 * 最后更新: 2026-07-26
 */
import { AppDataSource } from '../../src/config/database';
import { User } from '../../src/models/User';
import { ToolVaRHistory } from '../../src/models/ToolVaRHistory';

jest.mock('../../src/services/user.service', () => {
  const mockUserPresets: Record<string, any[]> = {};
  return {
    UserService: {
      getProfile: jest.fn().mockImplementation((userId: string) => Promise.resolve({
        user_id: userId,
        username: 'test-user',
        email: 'test@test.com',
        metadata: { var_presets: mockUserPresets[userId] || [] },
      })),
      updateProfile: jest.fn().mockImplementation((userId: string, data: any) => {
        if (data.metadata?.var_presets) mockUserPresets[userId] = data.metadata.var_presets;
        return Promise.resolve({ user_id: userId, metadata: { var_presets: mockUserPresets[userId] || [] } });
      }),
    },
  };
});

jest.mock('../../src/calculation/var', () => {
  const actual = jest.requireActual('../../src/calculation/var');
  return {
    ...actual,
    calculateHistoricalVaR: jest.fn().mockImplementation(() => {
      throw new Error('engine failure');
    }),
  };
});

import { ToolService } from '../../src/services/tool.service';

describe('ToolService fallback branch', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      username: 'test-tool-fallback-user-' + Date.now(),
      email: 'test-tool-fallback-' + Date.now() + '@test.com',
    });
    await userRepo.save(user);
    userId = user.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const historyRepo = AppDataSource.getRepository(ToolVaRHistory);
    await historyRepo.delete({ user_id: userId });
    await new Promise(r => setTimeout(r, 500));
    try { await userRepo.delete({ user_id: userId }); } catch (e) { /* ignore */ }
  });

  beforeEach(async () => {
    const historyRepo = AppDataSource.getRepository(ToolVaRHistory);
    await historyRepo.delete({ user_id: userId });
  });

  it('should fallback to parametric calculation when engine throws', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'historical',
      confidence_level: 0.95,
      time_horizon: 1,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });

    expect(result.status).toBe('fallback');
    expect(result.is_fallback).toBe(true);
    expect(result.method).toBe('parametric_fallback');
    expect(result).toHaveProperty('var_value');
    expect(result).toHaveProperty('history_id');
  });
});
