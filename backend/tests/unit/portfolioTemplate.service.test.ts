/**
 * [PRME-PA-005] portfolioTemplate.service 单元测试
 * 测试范围: 权重归一化、模板套用创建组合
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { PortfolioTemplateService } from '../../src/services/portfolioTemplate.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { User } from '../../src/models/User';
import { PortfolioTemplate } from '../../src/models/PortfolioTemplate';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';

jest.mock('../../src/services/portfolio.service', () => ({
  PortfolioService: {
    updateStatistics: jest.fn(),
  },
}));

describe('PortfolioTemplateService', () => {
  let userId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({ username: 'test-template-user', email: 'template@test.com' });
    await userRepo.save(user);
    userId = user.user_id;
  });

  afterAll(async () => {
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    const holdingRepo = AppDataSource.getRepository(Holding);
    const templateRepo = AppDataSource.getRepository(PortfolioTemplate);
    const userRepo = AppDataSource.getRepository(User);
    await holdingRepo.delete({ portfolio_id: 'dummy' });
    await portfolioRepo.delete({ user_id: userId });
    await templateRepo.clear();
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(async () => {
    const templateRepo = AppDataSource.getRepository(PortfolioTemplate);
    await templateRepo.clear();
    const template = templateRepo.create({
      name: '平衡型模板',
      risk_level: 'moderate',
      description: '测试模板',
      asset_allocation: JSON.stringify({ stock: 0.6, bond: 0.4 }),
      sector_allocation: JSON.stringify({ tech: 0.4, finance: 0.6 }),
      sample_holdings: JSON.stringify([
        { symbol: '000001', name: '平安银行', weight: 0.3, sector: '金融' },
        { symbol: '000002', name: '万科A', weight: 0.2, sector: '房地产' },
        { symbol: '600519', name: '贵州茅台', weight: 0.5, sector: '消费' },
      ]),
      base_total_value: 100000,
      disclaimer: '测试免责声明',
      is_builtin: true,
      sort_order: 1,
      is_active: true,
    });
    await templateRepo.save(template);
  });

  it('应列出活跃模板', async () => {
    const result = await PortfolioTemplateService.getTemplates();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.list[0]).toHaveProperty('template_id');
  });

  it('应按风险等级筛选模板', async () => {
    const result = await PortfolioTemplateService.getTemplates('moderate');
    expect(result.list.every((t: any) => t.risk_level === 'moderate')).toBe(true);
  });

  it('模板权重和不为 1 时应自动归一化', async () => {
    const templates = await PortfolioTemplateService.getTemplates();
    const template = templates.list[0];

    const result = await PortfolioTemplateService.applyTemplate(
      userId,
      template.template_id,
      '归一化测试组合',
      null,
      100000,
      {
        '000001': { weight: 60 },
        '000002': { weight: 40 },
        '600519': { weight: 50 },
      }
    );

    expect(result).toHaveProperty('portfolio_id');
    const totalWeight = result.holdings.reduce((sum: number, h: any) => sum + Number(h.weight), 0);
    expect(totalWeight).toBeCloseTo(1, 3);
    expect(PortfolioService.updateStatistics).toHaveBeenCalledWith(result.portfolio_id);
  });

  it('权重总和小于等于 0 时应抛出错误', async () => {
    const templates = await PortfolioTemplateService.getTemplates();
    const template = templates.list[0];

    await expect(
      PortfolioTemplateService.applyTemplate(userId, template.template_id, '错误组合', null, 100000, {
        '000001': { weight: 0 },
        '000002': { weight: 0 },
        '600519': { weight: 0 },
      })
    ).rejects.toThrow('模板权重总和必须大于 0');
  });
});
