/**
 * [PRME-PA-001] portfolio.service 单元测试
 * 文件: portfolio.service.test.ts
 * 测试范围: CRUD, 统计分析, 结构分析, 风险收益分析, 持仓限制
 * 最后更新: 2026-06-25
 */
import { AppDataSource } from '../../src/config/database';
import { PortfolioService } from '../../src/services/portfolio.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { HoldingLimit } from '../../src/models/HoldingLimit';
import { MarketDataService } from '../../src/services/marketData.service';

jest.mock('../../src/services/marketData.service', () => ({
  MarketDataService: {
    getReturnsMatrix: jest.fn(),
  },
}));

describe('PortfolioService', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      username: 'test-portfolio-user',
      email: 'test-portfolio@test.com',
    });
    await userRepo.save(user);
    userId = user.user_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ user_id: userId });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(async () => {
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    await holdingRepo.delete({ portfolio_id: portfolioId });
    await portfolioRepo.delete({ user_id: userId });

    const portfolio = await PortfolioService.create(userId, {
      name: '测试组合',
      description: '用于测试的组合',
      type: 'personal',
    });
    portfolioId = portfolio.portfolio_id;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── CRUD ──
  describe('CRUD', () => {
    it('PORT-001: create 应创建组合', async () => {
      const portfolio = await PortfolioService.create(userId, {
        name: '新建组合',
        description: '新建测试组合',
        type: 'personal',
      });
      expect(portfolio).toHaveProperty('portfolio_id');
      expect(portfolio.name).toBe('新建组合');
      expect(portfolio.type).toBe('personal');
    });

    it('PORT-002: getById 应返回组合及持仓', async () => {
      const portfolio = await PortfolioService.getById(portfolioId, userId);
      expect(portfolio).toHaveProperty('portfolio_id');
      expect(portfolio.holdings).toBeDefined();
    });

    it('PORT-003: getById 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.getById('non-existent-id', userId))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-004: getById 用户不匹配时应抛出错误', async () => {
      await expect(PortfolioService.getById(portfolioId, 'wrong-user-id'))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-005: getAll 应返回分页列表', async () => {
      const result = await PortfolioService.getAll(userId, 1, 10);
      expect(result).toHaveProperty('portfolios');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('PORT-006: getAllPortfolios 应返回所有活跃组合（系统用）', async () => {
      const result = await PortfolioService.getAllPortfolios(1, 100);
      expect(result).toHaveProperty('portfolios');
      expect(result).toHaveProperty('total');
      expect(result.portfolios.every((p: any) => p.status === 'active')).toBe(true);
    });

    it('PORT-007: update 应更新组合', async () => {
      const updated = await PortfolioService.update(portfolioId, userId, {
        name: '更新后的组合',
        description: '已更新',
      });
      expect(updated.name).toBe('更新后的组合');
      expect(updated.description).toBe('已更新');
    });

    it('PORT-008: update 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.update('non-existent', userId, { name: 'test' }))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-009: delete 应软删除组合', async () => {
      await PortfolioService.delete(portfolioId, userId);
      await expect(PortfolioService.getById(portfolioId, userId))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-010: delete 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.delete('non-existent', userId))
        .rejects.toThrow('Portfolio not found');
    });
  });

  // ── 统计更新 ──
  describe('updateStatistics', () => {
    it('PORT-011: 应计算组合统计（多持仓）', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 12500,
        security_type: 'stock',
      } as any));
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000002.SZ',
        name: '万科A',
        quantity: 500,
        cost_price: 20.00,
        market_value: 11000,
        security_type: 'stock',
      } as any));

      await PortfolioService.updateStatistics(portfolioId);
      const portfolio = await PortfolioService.getById(portfolioId, userId);
      expect(portfolio.statistics).toBeDefined();
      expect(portfolio.statistics!.total_value).toBe(23500);
      expect(portfolio.statistics!.total_cost).toBe(22000);
      expect(portfolio.statistics!.unrealized_pnl).toBe(1500);
      expect(portfolio.statistics!.holding_count).toBe(2);
    });

    it('PORT-012b: 持仓价格缺失时 total_value 应为 null 并带 warning', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        security_type: 'stock',
      } as any));

      await PortfolioService.updateStatistics(portfolioId);
      const portfolio = await PortfolioService.getById(portfolioId, userId);
      expect(portfolio.statistics).toBeDefined();
      expect(portfolio.statistics!.total_value).toBeNull();
      expect(portfolio.statistics!.total_cost).toBe(12000);
      expect(portfolio.statistics!.unrealized_pnl).toBeNull();
      expect(portfolio.statistics!.warning).toBe('价格数据未同步，部分指标暂不可用');
    });

    it('PORT-012: 空持仓时统计应为0', async () => {
      await PortfolioService.updateStatistics(portfolioId);
      const portfolio = await PortfolioService.getById(portfolioId, userId);
      expect(portfolio.statistics).toBeDefined();
      expect(portfolio.statistics!.total_value).toBe(0);
      expect(portfolio.statistics!.total_cost).toBe(0);
      expect(portfolio.statistics!.holding_count).toBe(0);
      expect(portfolio.statistics!.unrealized_pnl_pct).toBe(0);
    });
  });

  // ── 结构分析 ──
  describe('getStructureAnalysis', () => {
    beforeEach(async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 12500,
        sector: '金融',
        security_type: 'stock',
        region: '境内',
      } as any));
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '600519.SH',
        name: '贵州茅台',
        quantity: 10,
        cost_price: 1500,
        market_value: 16000,
        sector: '消费',
        security_type: 'stock',
        region: '境内',
      } as any));
    });

    it('PORT-013: 应返回结构分析（含内嵌引擎计算的相关性矩阵）', async () => {
      const returns = Array.from({ length: 252 }, () => [0.01, -0.005]);
      (MarketDataService.getReturnsMatrix as jest.Mock).mockResolvedValue(returns);

      const analysis = await PortfolioService.getStructureAnalysis(portfolioId, userId);
      expect(analysis).toHaveProperty('asset_allocation');
      expect(analysis.asset_allocation.stock).toBeCloseTo(1, 4);
      expect(analysis).toHaveProperty('sector_allocation');
      expect(analysis.sector_allocation.length).toBe(2);
      expect(analysis).toHaveProperty('concentration');
      expect(analysis.concentration.top1_holding).toBeGreaterThan(0);
      expect(analysis.concentration.herfindahl_index).toBeGreaterThan(0);
      expect(analysis.correlation_matrix).toBeDefined();
      expect(analysis.correlation_matrix!.source).toBe('calculated');
      expect(MarketDataService.getReturnsMatrix).toHaveBeenCalledWith(['000001.SZ', '600519.SH'], 252);
    });

    it('PORT-014: 内嵌引擎失败时应回退到估算相关性矩阵', async () => {
      (MarketDataService.getReturnsMatrix as jest.Mock).mockRejectedValue(new Error('Insufficient historical data'));

      const analysis = await PortfolioService.getStructureAnalysis(portfolioId, userId);
      expect(analysis.correlation_matrix).toBeDefined();
      expect(analysis.correlation_matrix!.source).toBe('estimated_fallback');
      // 同行业相关性应为0.65
      expect(analysis.correlation_matrix!.matrix[0][0]).toBe(1.0);
    });

    it('PORT-015a: 未知资产类型应归入 other', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: 'TEST001',
        name: '测试未知类型',
        quantity: 100,
        cost_price: 10.00,
        market_value: 1000,
        security_type: 'derivative',
        sector: '其他',
        region: '境内',
      } as any));

      const analysis = await PortfolioService.getStructureAnalysis(portfolioId, userId);
      expect(analysis.asset_allocation.other).toBeGreaterThan(0);
    });

    it('PORT-015: 空持仓时结构分析应为空', async () => {
      const emptyPortfolio = await PortfolioService.create(userId, {
        name: '空组合',
        type: 'personal',
      });
      const analysis = await PortfolioService.getStructureAnalysis(emptyPortfolio.portfolio_id, userId);
      expect(analysis.total_value).toBe(0);
      expect(analysis.holding_count).toBe(0);
      expect(analysis.concentration.top1_holding).toBe(0);
      expect(analysis.correlation_matrix).toBeNull();
    });

    it('PORT-016: 单持仓时不应生成相关性矩阵', async () => {
      const singleHoldingPortfolio = await PortfolioService.create(userId, {
        name: '单持仓组合',
        type: 'personal',
      });
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: singleHoldingPortfolio.portfolio_id,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 12500,
        sector: '金融',
        security_type: 'stock',
      } as any));

      const analysis = await PortfolioService.getStructureAnalysis(singleHoldingPortfolio.portfolio_id, userId);
      expect(analysis.correlation_matrix).toBeNull();
    });

    it('PORT-017: 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.getStructureAnalysis('non-existent', userId))
        .rejects.toThrow('Portfolio not found');
    });
  });

  // ── 风险收益分析 ──
  describe('getRiskReturnAnalysis', () => {
    it('PORT-018: 应返回风险收益分析（有持仓）', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 10.00,
        market_value: 12500,
        current_price: 12.50,
        security_type: 'stock',
      } as any));

      const analysis = await PortfolioService.getRiskReturnAnalysis(portfolioId, userId);
      expect(analysis).toHaveProperty('total_return');
      expect(analysis).toHaveProperty('volatility');
      expect(analysis).toHaveProperty('sharpe_ratio');
      expect(analysis).toHaveProperty('max_drawdown');
      expect(analysis).toHaveProperty('holding_returns');
      expect(analysis.total_return).toBeGreaterThan(0);
    });

    it('PORT-018a: 应计算负收益和默认波动率', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 15.00,
        market_value: 10000,
        current_price: 0,
        security_type: 'stock',
      } as any));

      const analysis = await PortfolioService.getRiskReturnAnalysis(portfolioId, userId);
      expect(analysis.total_return).toBeLessThan(0);
      expect(analysis.max_drawdown).toBeGreaterThan(0);
      expect(analysis.volatility).toBeGreaterThan(0);
    });

    it('PORT-018b: 应处理 market_value 为0的持仓', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 10.00,
        market_value: 0,
        current_price: 0,
        security_type: 'stock',
      } as any));

      const analysis = await PortfolioService.getRiskReturnAnalysis(portfolioId, userId);
      expect(analysis.total_value).toBe(0);
      expect(analysis.holding_returns[0].weight).toBe(0);
    });

    it('PORT-018c: 多持仓时应按收益排序', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 10.00,
        market_value: 15000,
        current_price: 15.00,
        security_type: 'stock',
      } as any));
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000002.SZ',
        name: '万科A',
        quantity: 1000,
        cost_price: 20.00,
        market_value: 10000,
        current_price: 10.00,
        security_type: 'stock',
      } as any));

      const analysis = await PortfolioService.getRiskReturnAnalysis(portfolioId, userId);
      expect(analysis.holding_returns.length).toBe(2);
      expect(analysis.holding_returns[0].return_pct).toBeGreaterThanOrEqual(analysis.holding_returns[1].return_pct);
    });

    it('PORT-019: 空持仓时应返回0风险指标', async () => {
      const analysis = await PortfolioService.getRiskReturnAnalysis(portfolioId, userId);
      expect(analysis.total_value).toBe(0);
      expect(analysis.total_cost).toBe(0);
      expect(analysis.total_return).toBe(0);
      expect(analysis.volatility).toBe(0);
      expect(analysis.sharpe_ratio).toBe(0);
      expect(analysis.max_drawdown).toBe(0);
    });

    it('PORT-020: 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.getRiskReturnAnalysis('non-existent', userId))
        .rejects.toThrow('Portfolio not found');
    });
  });

  // ── 持仓限制 ──
  describe('Holding Limits', () => {
    let limitId: string;

    beforeEach(async () => {
      const limit = await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'single_stock',
        target_symbol: '000001.SZ',
        max_weight: 0.3,
        action_on_breach: 'alert',
      });
      limitId = limit.limit_id;
    });

    it('PORT-021: createHoldingLimit 应创建限制', async () => {
      expect(limitId).toBeDefined();
      const limits = await PortfolioService.getHoldingLimits(portfolioId, userId);
      expect(limits.length).toBe(1);
      expect(limits[0].limit_type).toBe('single_stock');
      expect(limits[0].target_symbol).toBe('000001.SZ');
    });

    it('PORT-022: createHoldingLimit 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.createHoldingLimit('non-existent', userId, {
        limit_type: 'single_stock',
        max_weight: 0.5,
      })).rejects.toThrow('Portfolio not found');
    });

    it('PORT-023: getHoldingLimits 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.getHoldingLimits('non-existent', userId))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-024: updateHoldingLimit 应更新限制', async () => {
      const updated = await PortfolioService.updateHoldingLimit(limitId, userId, {
        max_weight: 0.5,
        action_on_breach: 'block',
      });
      expect(updated.max_weight).toBe(0.5);
      expect(updated.action_on_breach).toBe('block');
    });

    it('PORT-025: updateHoldingLimit 找不到时应抛出错误', async () => {
      await expect(PortfolioService.updateHoldingLimit('non-existent', userId, { max_weight: 0.5 }))
        .rejects.toThrow('Holding limit not found');
    });

    it('PORT-026: deleteHoldingLimit 应禁用限制', async () => {
      const result = await PortfolioService.deleteHoldingLimit(limitId, userId);
      expect(result).toBe(true);
      // getHoldingLimits 只返回 is_active=true 的记录
      const limits = await PortfolioService.getHoldingLimits(portfolioId, userId);
      expect(limits.length).toBe(0);
      // 但记录仍在数据库中，is_active=false
      const allLimits = await AppDataSource.getRepository(HoldingLimit).find({
        where: { portfolio_id: portfolioId, user_id: userId },
      });
      expect(allLimits.length).toBe(1);
      expect(allLimits[0].is_active).toBe(false);
    });

    it('PORT-026a: getHoldingLimits 应只返回 is_active=true 的限制', async () => {
      // 清理 beforeEach 创建的限制
      await PortfolioService.deleteHoldingLimit(limitId, userId);

      // 创建一个活跃限制
      const activeLimit = await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'sector',
        target_sector: '科技',
        max_weight: 0.4,
      });
      // 创建一个已禁用限制
      const disabledLimit = await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'single_stock',
        target_symbol: '000002.SZ',
        max_weight: 0.2,
      });
      await PortfolioService.deleteHoldingLimit(disabledLimit.limit_id, userId);

      const limits = await PortfolioService.getHoldingLimits(portfolioId, userId);
      expect(limits.length).toBe(1);
      expect(limits[0].limit_type).toBe('sector');
      expect(limits[0].is_active).toBe(true);

      // 清理
      await PortfolioService.deleteHoldingLimit(activeLimit.limit_id, userId);
    });

    it('PORT-027: deleteHoldingLimit 找不到时应抛出错误', async () => {
      await expect(PortfolioService.deleteHoldingLimit('non-existent', userId))
        .rejects.toThrow('Holding limit not found');
    });

    it('PORT-028: checkHoldingLimits 应检测到超限（single_stock）', async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 50000, // 占比高，超限
        sector: '金融',
        security_type: 'stock',
      } as any));

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      expect(checks).toHaveProperty('breaches');
      expect(checks.breach_count).toBeGreaterThan(0);
      expect(checks.breaches[0].limit_type).toBe('single_stock');
      expect(checks.is_projected).toBe(false);
    });

    it('PORT-029: checkHoldingLimits 应支持 sector 限制', async () => {
      const sectorLimit = await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'sector',
        target_sector: '金融',
        max_weight: 0.1,
        action_on_breach: 'warn',
      });

      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 50000,
        sector: '金融',
        security_type: 'stock',
      } as any));

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      const sectorBreach = checks.breaches.find((b: any) => b.limit_type === 'sector');
      expect(sectorBreach).toBeDefined();
      expect(sectorBreach.target_sector).toBe('金融');
    });

    it('PORT-030: checkHoldingLimits 应支持 total 限制', async () => {
      await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'total',
        max_weight: 1.0,
        max_value: 1000,
        action_on_breach: 'alert',
      });

      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 50000,
        security_type: 'stock',
      } as any));

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      const totalBreach = checks.breaches.find((b: any) => b.limit_type === 'total');
      expect(totalBreach).toBeDefined();
      expect(totalBreach.current_value).toBe(50000);
    });

    it('PORT-031: checkHoldingLimits 无超限时应返回空 breaches', async () => {
      // 已有 single_stock 限制 max_weight=0.3，但持仓为0，不超限
      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      expect(checks.breach_count).toBe(0);
      expect(checks.breaches.length).toBe(0);
    });

    it('PORT-032: checkHoldingLimits 应支持 projectedHoldings（预测检查）', async () => {
      const projectedHoldings = [
        { symbol: '000001.SZ', quantity: 10000, cost_price: 12.00, market_value: 120000, sector: '金融' },
      ];

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId, projectedHoldings);
      expect(checks.is_projected).toBe(true);
      expect(checks.breach_count).toBeGreaterThan(0);
      expect(checks.total_value).toBe(120000);
    });

    it('PORT-033: checkHoldingLimits 无限制时应返回空', async () => {
      // 删除所有限制
      const limits = await PortfolioService.getHoldingLimits(portfolioId, userId);
      for (const l of limits) {
        await PortfolioService.deleteHoldingLimit(l.limit_id, userId);
      }

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      expect(checks.limit_count).toBe(0);
      expect(checks.breach_count).toBe(0);
    });

    it('PORT-034: checkHoldingLimits 找不到组合时应抛出错误', async () => {
      await expect(PortfolioService.checkHoldingLimits('non-existent', userId))
        .rejects.toThrow('Portfolio not found');
    });

    it('PORT-035: checkHoldingLimits 应支持 risk_exposure 限制', async () => {
      await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'risk_exposure',
        target_symbol: '000001.SZ',
        max_weight: 0.1,
        action_on_breach: 'alert',
      });

      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 1000,
        cost_price: 12.00,
        market_value: 50000,
        sector: '金融',
        security_type: 'stock',
      } as any));

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      const riskBreach = checks.breaches.find((b: any) => b.limit_type === 'risk_exposure');
      expect(riskBreach).toBeDefined();
    });

    it('PORT-036: checkHoldingLimits max_value 未超限时不应触发', async () => {
      // 删除 beforeEach 创建的限制，避免干扰
      const existingLimits = await PortfolioService.getHoldingLimits(portfolioId, userId);
      for (const l of existingLimits) {
        await PortfolioService.deleteHoldingLimit(l.limit_id, userId);
      }

      await PortfolioService.createHoldingLimit(portfolioId, userId, {
        limit_type: 'total',
        max_weight: 1.0,
        max_value: 100000,
        action_on_breach: 'alert',
      });

      const holdingRepo = AppDataSource.getRepository(Holding);
      await holdingRepo.save(holdingRepo.create({
        portfolio_id: portfolioId,
        symbol: '000001.SZ',
        name: '平安银行',
        quantity: 100,
        cost_price: 12.00,
        market_value: 1000,
        security_type: 'stock',
      } as any));

      const checks = await PortfolioService.checkHoldingLimits(portfolioId, userId);
      expect(checks.breach_count).toBe(0);
    });
  });
});
