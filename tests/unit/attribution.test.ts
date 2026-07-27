import { AttributionService } from '../../src/services/attribution.service';
import { AppDataSource } from '../../src/config/database';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
  }),
  __esModule: true,
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
    }),
  },
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

describe('T-14 Brinson Attribution Model', () => {
  const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
  const holdingRepo = () => AppDataSource.getRepository(Holding);

  let testPortfolio: Portfolio;
  let testUserId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Seed test user (required by FK constraint)
    const userRepo = AppDataSource.getRepository('User');
    const existingUser = await userRepo.findOne({ where: { username: 'attrib-test-user' } });
    if (existingUser) {
      testUserId = (existingUser as any).user_id;
    } else {
      const user = userRepo.create({ username: 'attrib-test-user', email: 'attrib@test.com' });
      const saved = await userRepo.save(user);
      testUserId = (saved as any).user_id;
    }

    // Seed test portfolio
    testPortfolio = portfolioRepo().create({
      user_id: testUserId,
      name: 'Test Attribution Portfolio',
      type: 'personal',
      settings: { base_currency: 'CNY' },
    });
    await portfolioRepo().save(testPortfolio);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  afterEach(async () => {
    await holdingRepo().delete({ portfolio_id: testPortfolio.portfolio_id });
  });

  describe('TC-ATTRIB.1: Empty portfolio should fail', () => {
    it('should throw error when portfolio has no holdings', async () => {
      await expect(
        AttributionService.performBrinsonAttribution(testPortfolio.portfolio_id, testUserId)
      ).rejects.toThrow('Portfolio has no holdings');
    });
  });

  describe('TC-ATTRIB.2: Single sector portfolio attribution', () => {
    it('should calculate attribution with single sector', async () => {
      // Create 2 holdings in same sector
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'MSFT',
          name: 'Microsoft',
          sector: '科技',
          quantity: 50,
          cost_price: 200,
          current_price: 300,
          market_value: 15000,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId
      );

      // 单 sector 时等权基准权重 = 1，基准收益 = 组合收益
      // 所以 excess_return = 0，所有效应 = 0
      expect(result).toBeDefined();
      expect(result.portfolio_return).toBeCloseTo(0.5, 1); // 50%
      expect(result.benchmark_return).toBeCloseTo(0.5, 1);
      expect(result.excess_return).toBeCloseTo(0, 1);
      expect(result.allocation_effect).toBeCloseTo(0, 1);
      expect(result.selection_effect).toBeCloseTo(0, 1);
      expect(result.interaction_effect).toBeCloseTo(0, 1);
      expect(result.sector_details).toHaveLength(1);
      expect(result.sector_details[0].sector).toBe('科技');
    });
  });

  describe('TC-ATTRIB.3: Multi-sector portfolio attribution', () => {
    it('should calculate allocation, selection, and interaction effects', async () => {
      // 2 sectors: 科技 (50% weight, 50% return) vs 金融 (50% weight, 20% return)
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'JPM',
          name: 'JPMorgan',
          sector: '金融',
          quantity: 100,
          cost_price: 100,
          current_price: 120,
          market_value: 12000,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId
      );

      expect(result).toBeDefined();
      expect(result.sector_details).toHaveLength(2);
      expect(result.sector_details[0].total_effect).toBeDefined();
      expect(result.sector_details[1].total_effect).toBeDefined();

      // 验证：allocation + selection + interaction = excess_return
      const totalEffect = result.allocation_effect + result.selection_effect + result.interaction_effect;
      expect(totalEffect).toBeCloseTo(result.excess_return, 2);
    });
  });

  describe('TC-ATTRIB.4: Custom benchmark support', () => {
    it('should accept custom benchmark weights and returns', async () => {
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'JPM',
          name: 'JPMorgan',
          sector: '金融',
          quantity: 100,
          cost_price: 100,
          current_price: 120,
          market_value: 12000,
        }),
      ]);

      const customBenchmark = {
        sectors: { 科技: 0.6, 金融: 0.4 },
        returns: { 科技: 0.3, 金融: 0.15 },
      };

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId,
        customBenchmark
      );

      expect(result).toBeDefined();
      expect(result.benchmark_return).toBeCloseTo(0.6 * 0.3 + 0.4 * 0.15, 2);
      expect(result.sector_details).toHaveLength(2);

      // 验证各项效应之和 = 超额收益
      const totalEffect = result.allocation_effect + result.selection_effect + result.interaction_effect;
      expect(totalEffect).toBeCloseTo(result.excess_return, 2);
    });
  });

  describe('TC-ATTRIB.6: Edge cases', () => {
    it('should use default sector when sector is missing', async () => {
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: undefined as any,
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId
      );

      expect(result.sector_details).toHaveLength(1);
      expect(result.sector_details[0].sector).toBe('未分类');
    });

    it('should handle zero cost holdings', async () => {
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: undefined as any,
          current_price: 150,
          market_value: 15000,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId
      );

      expect(result.sector_details).toHaveLength(1);
      expect(result.sector_details[0].portfolio_return).toBe(0);
    });
  });

  describe('TC-ATTRIB.7: Portfolio not found', () => {
    it('should throw error when portfolio does not exist', async () => {
      await expect(
        AttributionService.performBrinsonAttribution('non-existent-portfolio', testUserId)
      ).rejects.toThrow('Portfolio not found');
    });
  });

  describe('TC-ATTRIB.8: Default currency and missing fields', () => {
    it('should use CNY default when portfolio has no base_currency setting', async () => {
      const portfolioWithoutCurrency = portfolioRepo().create({
        user_id: testUserId,
        name: 'No Currency Portfolio',
        type: 'personal',
      });
      await portfolioRepo().save(portfolioWithoutCurrency);

      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: portfolioWithoutCurrency.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        portfolioWithoutCurrency.portfolio_id,
        testUserId
      );
      expect(result.currency).toBe('CNY');

      await holdingRepo().delete({ portfolio_id: portfolioWithoutCurrency.portfolio_id });
      await portfolioRepo().delete({ portfolio_id: portfolioWithoutCurrency.portfolio_id });
    });
  });

  describe('TC-ATTRIB.9: Custom benchmark with missing sectors', () => {
    it('should treat missing benchmark sectors as zero', async () => {
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'AAPL',
          name: 'Apple',
          sector: '科技',
          quantity: 100,
          cost_price: 100,
          current_price: 150,
          market_value: 15000,
        }),
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'JPM',
          name: 'JPMorgan',
          sector: '金融',
          quantity: 100,
          cost_price: 100,
          current_price: 120,
          market_value: 12000,
        }),
      ]);

      // Custom benchmark only defines 科技, missing 金融
      const customBenchmark = {
        sectors: { 科技: 1.0 },
        returns: { 科技: 0.5 },
      };

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId,
        customBenchmark
      );
      expect(result).toBeDefined();
      expect(result.sector_details).toHaveLength(2);
    });
  });

  describe('TC-ATTRIB.10: Zero total value and zero total cost', () => {
    it('should handle zero market_value and zero cost holdings', async () => {
      await holdingRepo().save([
        holdingRepo().create({
          portfolio_id: testPortfolio.portfolio_id,
          symbol: 'ZERO',
          name: 'Zero Value',
          sector: '科技',
          quantity: 0,
          cost_price: 0,
          current_price: 0,
          market_value: 0,
        }),
      ]);

      const result = await AttributionService.performBrinsonAttribution(
        testPortfolio.portfolio_id,
        testUserId
      );
      expect(result).toBeDefined();
      expect(result.portfolio_return).toBe(0);
    });
  });
});
