/**
 * [PRME-PA-004] holdingImport.service 单元测试
 * 测试范围: 单次导入 100 条上限、导入后触发 VaR/压力测试
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { HoldingImportService } from '../../src/services/holdingImport.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { VaRService } from '../../src/services/var.service';
import { StressService } from '../../src/services/stress.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';

jest.mock('../../src/services/portfolio.service', () => ({
  PortfolioService: {
    updateStatistics: jest.fn(),
  },
}));

jest.mock('../../src/services/var.service', () => ({
  VaRService: {
    calculate: jest.fn().mockResolvedValue({ var_id: 'v1' }),
  },
}));

jest.mock('../../src/services/stress.service', () => ({
  StressService: {
    runStressTest: jest.fn().mockResolvedValue({ stress_id: 's1' }),
  },
}));

jest.mock('exceljs', () => {
  const mockWorksheet = (rowCount: number) => ({
    getRow: (n: number) => {
      if (n === 1) return { values: [null, 'symbol', 'quantity', 'cost_price'] };
      return {
        values: [null, `00000${n}`, n * 100, 10],
      };
    },
    eachRow: (cb: (row: any, rowNumber: number) => void) => {
      for (let i = 2; i <= rowCount + 1; i++) {
        cb({ values: [null, `00000${i}`, i * 100, 10] }, i);
      }
    },
  });

  return {
    Workbook: jest.fn().mockImplementation(() => ({
      csv: { read: jest.fn().mockResolvedValue(undefined) },
      xlsx: { readFile: jest.fn().mockResolvedValue(undefined) },
      getWorksheet: jest.fn().mockImplementation((n: number) => {
        return n === 1 ? mockWorksheet((global as any).__TEST_ROW_COUNT__ || 1) : undefined;
      }),
    })),
  };
});

describe('HoldingImportService', () => {
  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);

    const user = userRepo.create({ username: 'test-import-user', email: 'import@test.com' });
    await userRepo.save(user);
    userId = user.user_id;

    const portfolio = portfolioRepo.create({
      user_id: userId,
      name: '导入测试组合',
      type: 'personal',
      status: 'active',
    });
    await portfolioRepo.save(portfolio);
    portfolioId = portfolio.portfolio_id;
  });

  afterAll(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const portfolioRepo = AppDataSource.getRepository(Portfolio);
    await portfolioRepo.delete({ portfolio_id: portfolioId });
    await userRepo.delete({ user_id: userId });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeFile = (originalname: string): any => ({
    originalname,
    path: '/tmp/test.xlsx',
    size: 1024,
  });

  it('B-01: 导入超过 100 行时应拒绝', async () => {
    (global as any).__TEST_ROW_COUNT__ = 101;
    await expect(
      HoldingImportService.importFromFile(portfolioId, userId, makeFile('test.xlsx'))
    ).rejects.toThrow('单次导入上限为 100 条');
  });

  it('B-02: 导入成功后应异步触发 VaR 与压力测试', async () => {
    (global as any).__TEST_ROW_COUNT__ = 2;
    const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('test.xlsx'));

    expect(result.success).toBe(true);
    expect(result.total_rows).toBe(2);
    expect(VaRService.calculate).toHaveBeenCalledWith(
      userId,
      portfolioId,
      expect.objectContaining({ method: 'historical' })
    );
    expect(StressService.runStressTest).toHaveBeenCalledWith(
      userId,
      portfolioId,
      '2008_financial_crisis'
    );
  });
});
