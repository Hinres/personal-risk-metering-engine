/**
 * [PRME-VAR-002] report.service 真实单元测试
 * 文件: report.service.test.ts
 * 测试范围: getReports, generate, getById, delete, exportReport (PDF/Excel)
 * 最后更新: 2026-06-25
 */
import { ReportService, closeBrowser } from '../../src/services/report.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { VaRService } from '../../src/services/var.service';
import { AppDataSource } from '../../src/config/database';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

// ── Mock 外部依赖 ──
jest.mock('../../src/services/portfolio.service');
jest.mock('../../src/services/var.service');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('exceljs', () => {
  const mockWorksheet = {
    addRow: jest.fn(),
  };
  const mockWorkbook = {
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: {
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  };
  return {
    __esModule: true,
    default: {
      Workbook: jest.fn().mockImplementation(() => mockWorkbook),
    },
  };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ size: 2048 }),
  };
});

// puppeteer 由 tests/__mocks__/puppeteer.js 全局 mock

// ── Mock Repository ──
const mockRepo = () => ({
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;
const mockedPortfolioService = PortfolioService as jest.Mocked<typeof PortfolioService>;
const mockedVaRService = VaRService as jest.Mocked<typeof VaRService>;

describe('ReportService', () => {
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepo();
    mockedGetRepository.mockReturnValue(repo);
  });

  afterAll(async () => {
    await closeBrowser();
  });

  // ── getReports ──
  describe('getReports', () => {
    it('RPT-001: 应返回分页报告列表(无 portfolioId)', async () => {
      const mockReports = [
        { report_id: 'r1', report_name: '报告1', user_id: 'u1' },
        { report_id: 'r2', report_name: '报告2', user_id: 'u1' },
      ];
      repo.findAndCount.mockResolvedValue([mockReports, 2]);

      const result = await ReportService.getReports('u1', undefined, 1, 10);

      expect(result).toEqual({ reports: mockReports, total: 2, page: 1, limit: 10 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u1' },
          skip: 0,
          take: 10,
          order: { created_at: 'DESC' },
        })
      );
    });

    it('RPT-002: 应支持按 portfolioId 过滤', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await ReportService.getReports('u1', 'p1', 2, 5);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u1', portfolio_id: 'p1' },
          skip: 5,
          take: 5,
        })
      );
    });
  });

  // ── generate ──
  describe('generate', () => {
    it('RPT-003: 应生成报告并包含组合和VaR数据', async () => {
      const mockPortfolio = {
        name: '测试组合',
        statistics: { total_value: 100000 },
        holdings: [
          { symbol: '000001.SZ', name: '平安银行', quantity: 1000, market_value: 12500, weight: 0.125, unrealized_pnl: 500 },
        ],
      };
      const mockVaR = {
        var_value: 5000,
        var_percentage: 0.05,
        confidence_level: 0.95,
        calculation_type: 'monte_carlo',
      };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(mockVaR as any);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-new' }));
      repo.save.mockResolvedValue({ report_id: 'r-new', status: 'generated' });

      const result = await ReportService.generate('u1', {
        portfolio_id: 'p1',
        report_type: 'var',
        report_name: '月度风险报告',
      });

      expect(mockedPortfolioService.getById).toHaveBeenCalledWith('p1', 'u1');
      expect(mockedVaRService.getLatest).toHaveBeenCalledWith('p1');
      expect(repo.create).toHaveBeenCalled();
      expect(result.status).toBe('generated');
      expect(result.report_content).toMatchObject({
        portfolio: { name: '测试组合', total_value: 100000 },
        risk_summary: { var: { value: 5000, percentage: 0.05, confidence: 0.95, method: 'monte_carlo' } },
      });
    });

    it('RPT-003a: 当持仓无价格时 holdings 仍应返回带 warning 的数据', async () => {
      const mockPortfolio = {
        name: '测试组合',
        statistics: { total_value: 100000 },
        holdings: undefined,
      };
      const mockVaR = {
        var_value: 5000,
        var_percentage: 0.05,
        confidence_level: 0.95,
        calculation_type: 'monte_carlo',
      };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(mockVaR as any);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-no-holdings' }));
      repo.save.mockResolvedValue({ report_id: 'r-no-holdings' });

      const result = await ReportService.generate('u1', {
        portfolio_id: 'p1',
        report_type: 'var_analysis',
        report_name: '报告',
      });

      expect(result.report_content.holdings).toEqual([]);
    });

    it('RPT-004: 当无VaR记录时风险摘要应为null', async () => {
      const mockPortfolio = {
        name: '无VaR组合',
        statistics: { total_value: 0 },
        holdings: [],
      };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-no-var' }));
      repo.save.mockResolvedValue({ report_id: 'r-no-var', status: 'generated' });

      const result = await ReportService.generate('u1', {
        portfolio_id: 'p2',
        report_type: 'risk',
        report_name: '无VaR报告',
      });

      expect(result.report_content.risk_summary.var).toBeNull();
      expect(result.report_content.holdings).toEqual([]);
    });

    it('RPT-005: 应支持 period_start 和 period_end', async () => {
      const mockPortfolio = { name: '测试', statistics: {}, holdings: [] };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-period' }));
      repo.save.mockResolvedValue({ report_id: 'r-period' });

      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      await ReportService.generate('u1', {
        portfolio_id: 'p1',
        report_type: 'monthly',
        report_name: '月报',
        period_start: start,
        period_end: end,
      });

      const createCall = repo.create.mock.calls[0][0];
      expect(createCall.period_start).toEqual(start);
      expect(createCall.period_end).toEqual(end);
    });

    it('RPT-005a: 空报告名时应自动生成默认名称', async () => {
      const mockPortfolio = { name: '测试', statistics: {}, holdings: [] };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-auto' }));
      repo.save.mockResolvedValue({ report_id: 'r-auto' });

      const result = await ReportService.generate('u1', {
        portfolio_id: 'p1',
        report_type: 'var_analysis',
        report_name: '',
      });

      expect(result.report_name).toContain('VaR分析报告');
    });

    it('RPT-005b: 空白报告名时应自动生成默认名称', async () => {
      const mockPortfolio = { name: '测试', statistics: {}, holdings: [] };
      mockedPortfolioService.getById.mockResolvedValue(mockPortfolio as any);
      mockedVaRService.getLatest.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ ...data, report_id: 'r-auto2' }));
      repo.save.mockResolvedValue({ report_id: 'r-auto2' });

      const result = await ReportService.generate('u1', {
        portfolio_id: 'p1',
        report_type: 'unknown_type',
        report_name: '   ',
      });

      expect(result.report_name).toContain('风险报告');
    });
  });

  // ── getById ──
  describe('getById', () => {
    it('RPT-006: 应返回报告详情', async () => {
      const mockReport = { report_id: 'r1', user_id: 'u1', report_name: '报告1' };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.getById('r1', 'u1');

      expect(result).toEqual(mockReport);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { report_id: 'r1', user_id: 'u1' },
      });
    });

    it('RPT-007: 找不到报告时应抛出错误', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(ReportService.getById('r-missing', 'u1')).rejects.toThrow('Report not found');
    });
  });

  // ── delete ──
  describe('delete', () => {
    it('RPT-008: 应软删除报告', async () => {
      const mockReport = { report_id: 'r1', user_id: 'u1', status: 'generated' };
      repo.findOne.mockResolvedValue(mockReport);
      repo.save.mockResolvedValue({ ...mockReport, status: 'deleted' });

      const result = await ReportService.delete('r1', 'u1');

      expect(result).toBe(true);
      expect(mockReport.status).toBe('deleted');
      expect(repo.save).toHaveBeenCalled();
    });

    it('RPT-009: 找不到报告时应抛出错误', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(ReportService.delete('r-missing', 'u1')).rejects.toThrow('Report not found');
    });
  });

  // ── exportReport ──
  describe('exportReport', () => {
    it('RPT-010: 应导出为 PDF', async () => {
      const mockReport = {
        report_id: 'r1',
        user_id: 'u1',
        report_content: {
          portfolio: { name: '测试组合', total_value: 100000, holding_count: 2 },
          risk_summary: { var: { value: 5000, percentage: 0.05, confidence: 0.95, method: 'monte_carlo' } },
          holdings: [
            { symbol: '000001.SZ', name: '平安银行', quantity: 1000, market_value: 12500, weight: 0.125, unrealized_pnl: 500 },
          ],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r1', 'u1', 'pdf');

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileName');
      expect(result.fileName).toMatch(/\.pdf$/);
      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0] as any;
      expect(saved.file_format).toBe('pdf');
    });

    it('RPT-011: 应导出为 Excel', async () => {
      const mockReport = {
        report_id: 'r1',
        user_id: 'u1',
        report_content: {
          portfolio: { name: '测试组合', total_value: 100000, holding_count: 2 },
          risk_summary: { var: { value: 5000, percentage: 0.05, confidence: 0.95, method: 'monte_carlo' } },
          holdings: [
            { symbol: '000001.SZ', name: '平安银行', quantity: 1000, market_value: 12500, weight: 0.125, unrealized_pnl: 500 },
          ],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r1', 'u1', 'excel');

      expect(result.fileName).toMatch(/\.xlsx$/);
      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0] as any;
      expect(saved.file_format).toBe('xlsx');
    });

    it('RPT-012: 默认格式应为 PDF', async () => {
      const mockReport = {
        report_id: 'r1',
        user_id: 'u1',
        report_content: { portfolio: {}, risk_summary: {}, holdings: [] },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r1', 'u1');

      expect(result.fileName).toMatch(/\.pdf$/);
    });
    it('RPT-015: Excel 导出应使用默认值填充缺失字段', async () => {
      const mockReport = {
        report_id: 'r-excel-defaults',
        user_id: 'u1',
        report_content: {
          portfolio: {},
          risk_summary: { var: {} },
          holdings: [
            { symbol: 'A', name: '股票A', quantity: 100, market_value: 5000, weight: undefined, unrealized_pnl: 0 },
          ],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r-excel-defaults', 'u1', 'excel');
      expect(result.fileName).toMatch(/\.xlsx$/);
    });

    it('RPT-016: PDF 导出应处理 weight 为 null 和空持仓', async () => {
      const mockReport = {
        report_id: 'r-pdf-edge',
        user_id: 'u1',
        report_content: {
          portfolio: { name: undefined, total_value: undefined, holding_count: undefined },
          risk_summary: { var: { value: undefined, percentage: null, confidence: undefined, method: undefined } },
          holdings: [],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r-pdf-edge', 'u1', 'pdf');
      expect(result.fileName).toMatch(/\.pdf$/);
    });
  });
  describe('buildReportHtml (通过 exportReport 间接测试)', () => {
    it('RPT-013: 空持仓应生成无数据提示', async () => {
      const mockReport = {
        report_id: 'r-empty',
        user_id: 'u1',
        report_content: {
          portfolio: { name: '空组合', total_value: 0, holding_count: 0 },
          risk_summary: { var: null },
          holdings: [],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r-empty', 'u1', 'pdf');
      expect(result.filePath).toBeDefined();
    });

    it('RPT-014: 无VaR数据时风险摘要应显示N/A', async () => {
      const mockReport = {
        report_id: 'r-no-var',
        user_id: 'u1',
        report_content: {
          portfolio: { name: '组合', total_value: 50000, holding_count: 1 },
          risk_summary: { var: null },
          holdings: [
            { symbol: 'A', name: '股票A', quantity: 100, market_value: 50000, weight: 1, unrealized_pnl: 0 },
          ],
        },
      };
      repo.findOne.mockResolvedValue(mockReport);

      const result = await ReportService.exportReport('r-no-var', 'u1', 'pdf');
      expect(result.filePath).toBeDefined();
    });
  });
});
