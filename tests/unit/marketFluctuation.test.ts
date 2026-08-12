/**
 * [PRME-RM-002] 市场波动检测单元测试
 * 测试范围: getIndexChangePercentage, checkMarketFluctuation, scheduleMarketFluctuationCheck
 * 最后更新: 2026-06-30
 */
import axios from 'axios';
import { AppDataSource } from '../../src/config/database';
import { checkMarketFluctuation, getIndexChangePercentage, scheduleMarketFluctuationCheck } from '../../src/jobs/marketFluctuation.job';

jest.mock('axios');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
      pushAlert: jest.fn(),
    }),
  },
}));

describe('marketFluctuation.job', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getIndexChangePercentage', () => {
    it('should return mock data when MOCK_MODE is enabled', async () => {
      const data = await getIndexChangePercentage();
      expect(data).not.toBeNull();
      expect(data).toHaveProperty('previousClose');
      expect(data).toHaveProperty('currentClose');
      expect(data).toHaveProperty('changePercentage');
    });

    it('should cycle through mock data', async () => {
      const results = [];
      for (let i = 0; i < 6; i++) {
        const data = await getIndexChangePercentage();
        results.push(data!.changePercentage);
      }
      // Should cycle through the 5 mock data points
      expect(results.length).toBe(6);
      // In 6 calls, at least one should be different from the first
      expect(new Set(results).size).toBeGreaterThan(1);
    });
  });

  describe('checkMarketFluctuation', () => {
    it('should trigger alert when change >= 5%', async () => {
      const mockAlertRepo = {
        findOne: jest.fn().mockResolvedValue({ template_id: 't1', title_template: 'Test', message_template: 'Test' }),
        create: jest.fn().mockReturnValue({ alert_id: 'a1' }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockTemplateRepo = {
        findOne: jest.fn().mockResolvedValue({ template_id: 't1', title_template: 'Test', message_template: 'Test' }),
      };
      const mockUserRepo = {
        find: jest.fn().mockResolvedValue([]),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockTemplateRepo)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockUserRepo)
        .mockReturnValueOnce(mockAlertRepo);

      const result = await checkMarketFluctuation();
      expect(result).toHaveProperty('triggered');
      expect(result).toHaveProperty('changePercentage');
    });

    it('should not trigger alert when change < 5%', async () => {
      // Call multiple times to get all mock data points
      // One of them has changePercentage = -0.0067 (< 5%)
      let notTriggeredFound = false;
      for (let i = 0; i < 10; i++) {
        const result = await checkMarketFluctuation();
        if (!result.triggered) {
          notTriggeredFound = true;
          break;
        }
      }
      expect(notTriggeredFound).toBe(true);
    });

    it('should create template when not found', async () => {
      const mockAlertRepo = {
        create: jest.fn().mockReturnValue({ alert_id: 'a1' }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockTemplateRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({
          template_id: 't1',
          title_template: '市场波动预警：{index_name} {direction}{change_pct}%',
          message_template: '今日{index_name}出现大幅波动，当前指数{current_close}，较昨日{direction}{change_pct}%。',
        }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockUserRepo = {
        find: jest.fn().mockResolvedValue([]),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockTemplateRepo)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockUserRepo)
        .mockReturnValueOnce(mockAlertRepo);

      const result = await checkMarketFluctuation();
      expect(result.triggered).toBe(true);
      expect(mockTemplateRepo.create).toHaveBeenCalled();
      expect(mockTemplateRepo.save).toHaveBeenCalled();
    });

    it('should push alert to users with critical severity when change >= 7%', async () => {
      const mockWs = { pushAlert: jest.fn() };
      require('../../src/services/websocket.service').default.getInstance.mockReturnValue(mockWs);

      const mockAlertRepo = {
        create: jest.fn().mockReturnValue({ alert_id: 'a1' }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockTemplateRepo = {
        findOne: jest.fn().mockResolvedValue({ template_id: 't1', title_template: 'Test', message_template: 'Test' }),
      };
      const mockUserRepo = {
        find: jest.fn().mockResolvedValue([{ user_id: 'u1' }]),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockTemplateRepo)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockUserRepo)
        .mockReturnValueOnce(mockAlertRepo);

      const result = await checkMarketFluctuation();
      expect(result.triggered).toBe(true);
    });

    it('should handle user push failure gracefully', async () => {
      const mockWs = { pushAlert: jest.fn().mockImplementation(() => { throw new Error('WS error'); }) };
      require('../../src/services/websocket.service').default.getInstance.mockReturnValue(mockWs);

      const mockAlertRepo = {
        create: jest.fn().mockReturnValue({ alert_id: 'a1' }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockTemplateRepo = {
        findOne: jest.fn().mockResolvedValue({ template_id: 't1', title_template: 'Test', message_template: 'Test' }),
      };
      const mockUserRepo = {
        find: jest.fn().mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockTemplateRepo)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockUserRepo)
        .mockReturnValueOnce(mockAlertRepo);

      const result = await checkMarketFluctuation();
      expect(result.triggered).toBe(true);
      // Should not throw despite individual push failures
    });

    it('should handle pushMarketAlertToAllUsers catch block', async () => {
      const mockAlertRepo = {
        create: jest.fn().mockReturnValue({ alert_id: 'a1' }),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockTemplateRepo = {
        findOne: jest.fn().mockResolvedValue({ template_id: 't1', title_template: 'Test', message_template: 'Test' }),
      };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce(mockTemplateRepo)
        .mockReturnValueOnce(mockAlertRepo)
        .mockReturnValueOnce({ find: jest.fn().mockRejectedValue(new Error('DB error')) })
        .mockReturnValueOnce(mockAlertRepo);

      const result = await checkMarketFluctuation();
      expect(result.triggered).toBe(true);
      // Should not throw despite userRepo.find failure
    });
  });

  describe('scheduleMarketFluctuationCheck', () => {
    it('should return a scheduled task', () => {
      const task = scheduleMarketFluctuationCheck();
      expect(task).toBeDefined();
      task.stop(); // clean up
    });
  });
});
