import { AppDataSource } from '../../src/config/database';
import { ToolService } from '../../src/services/tool.service';
import { User } from '../../src/models/User';
import { ToolVaRHistory } from '../../src/models/ToolVaRHistory';

jest.mock('../../src/services/user.service', () => {
  // In-memory store for mock presets per user
  const mockUserPresets: Record<string, any[]> = {};

  return {
    UserService: {
      getProfile: jest.fn().mockImplementation((userId: string) => {
        return Promise.resolve({
          user_id: userId,
          username: 'test-user',
          email: 'test@test.com',
          metadata: {
            var_presets: mockUserPresets[userId] || [],
          },
        });
      }),
      updateProfile: jest.fn().mockImplementation((userId: string, data: any) => {
        if (data.metadata?.var_presets) {
          mockUserPresets[userId] = data.metadata.var_presets;
        }
        return Promise.resolve({
          user_id: userId,
          metadata: {
            var_presets: mockUserPresets[userId] || [],
          },
        });
      }),
    },
  };
});

// Need to mock before importing the module that uses it
describe('ToolService', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      username: 'test-tool-user-' + Date.now(),
      email: 'test-tool-' + Date.now() + '@test.com',
    });
    await userRepo.save(user);
    userId = user.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const historyRepo = AppDataSource.getRepository(ToolVaRHistory);
    // 先删历史记录（外键约束），再删用户
    await historyRepo.delete({ user_id: userId });
    await new Promise(r => setTimeout(r, 500)); // 等待 SQLite 完成
    try {
      await userRepo.delete({ user_id: userId });
    } catch (e) {
      // 忽略外键约束错误，测试数据清理
    }
  });

  beforeEach(async () => {
    const historyRepo = AppDataSource.getRepository(ToolVaRHistory);
    await historyRepo.delete({ user_id: userId });
  });

  it('should reject empty holdings', async () => {
    await expect(
      ToolService.calculateVaR(userId, {
        method: 'historical',
        confidence_level: 0.95,
        time_horizon: 1,
        holdings: [],
      })
    ).rejects.toThrow('Holdings cannot be empty');
  });

  it('should calculate VaR with fallback on engine failure', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'historical',
      confidence_level: 0.95,
      time_horizon: 1,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });
    expect(result).toHaveProperty('var_value');
    expect(result).toHaveProperty('history_id');
  });

  it('should save calculation history', async () => {
    await ToolService.calculateVaR(userId, {
      method: 'parametric',
      confidence_level: 0.99,
      time_horizon: 7,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });

    const history = await ToolService.getHistory(userId, 1, 10);
    expect(history.total).toBeGreaterThanOrEqual(1);
    expect(history.history[0].method).toBe('parametric');
  });

  it('should update existing preset', async () => {
    await ToolService.savePreset(userId, 'existing', { method: 'historical' });
    await ToolService.savePreset(userId, 'existing', { method: 'monte_carlo' });

    const presets = await ToolService.getPresets(userId);
    expect(presets.length).toBe(1);
    expect(presets[0].method).toBe('monte_carlo');
  });

  it('should throw when history not found', async () => {
    await expect(ToolService.getHistoryById(userId, 'non-existent'))
      .rejects.toThrow('History record not found');
  });

  it('should calculate parametric VaR', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'parametric',
      confidence_level: 0.95,
      time_horizon: 1,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });
    expect(result).toHaveProperty('var_value');
    expect(result.status).toBe('completed');
  });

  it('should calculate Monte Carlo VaR', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'monte_carlo',
      confidence_level: 0.95,
      time_horizon: 1,
      monte_carlo_iterations: 1000,
      random_seed: 42,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
        { symbol: '000002.SZ', quantity: 100, current_price: 8.50 },
      ],
    });
    expect(result).toHaveProperty('var_value');
  });

  it('should calculate extreme value VaR with MLE distribution', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'extreme_value',
      confidence_level: 0.95,
      time_horizon: 1,
      distribution: 'mle',
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });
    expect(result).toHaveProperty('var_value');
  });

  it('should use default z-score for unknown confidence level', async () => {
    const result = await ToolService.calculateVaR(userId, {
      method: 'parametric',
      confidence_level: 0.975,
      time_horizon: 1,
      holdings: [
        { symbol: '000001.SZ', quantity: 100, current_price: 12.50 },
      ],
    });
    expect(result.status).toBe('completed');
    expect(result).toHaveProperty('var_value');
  });

  it('should save and retrieve presets', async () => {
    await ToolService.savePreset(userId, '我的预设', {
      method: 'monte_carlo',
      confidence_level: 0.95,
      time_horizon: 1,
    });

    const presets = await ToolService.getPresets(userId);
    expect(presets.length).toBe(1);
    expect(presets[0].name).toBe('我的预设');

    await ToolService.deletePreset(userId, '我的预设');
    const afterDelete = await ToolService.getPresets(userId);
    expect(afterDelete.length).toBe(0);
  });
});
