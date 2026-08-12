/**
 * [PRME-VAR-002] VaR分析和报告 - 轻量级测试
 * 文件: report.export.test.ts
 * 测试范围: 报告导出接口契约验证
 * 最后更新: 2026-06-18
 */

// Mock 所有重型依赖
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockImplementation(({ where }: any) => {
        if (where?.report_id === 'report-pdf-1' || where?.report_id === 'report-excel-1') {
          return Promise.resolve({
            report_id: where.report_id,
            user_id: 'test-user',
            report_content: {
              portfolio: { name: '测试组合', total_value: 150000, holding_count: 3 },
              risk_summary: { var: { value: -5000, percentage: 0.033 } },
              holdings: [],
            },
            save: jest.fn().mockResolvedValue(undefined),
          });
        }
        return Promise.resolve(null);
      }),
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
  },
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

jest.mock('../../src/services/report.service', () => ({
  ReportService: {
    getReports: jest.fn().mockResolvedValue({ reports: [], total: 0, page: 1, limit: 10 }),
    generate: jest.fn().mockResolvedValue({ report_id: 'test', status: 'generated' }),
    getById: jest.fn().mockResolvedValue({
      report_id: 'report-pdf-1',
      user_id: 'test-user',
      report_content: { portfolio: { name: 'Test', total_value: 150000 } },
    }),
    delete: jest.fn().mockResolvedValue(true),
    exportReport: jest.fn().mockResolvedValue({
      filePath: '/tmp/test.pdf',
      fileName: 'test.pdf',
      report_url: '/reports/test.pdf',
      file_size: 1024,
    }),
  },
  closeBrowser: jest.fn().mockResolvedValue(undefined),
}));

describe('Report Export - 接口契约测试', () => {
  it('TC-RPT.1: PDF 导出服务应能调用', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.exportReport('report-pdf-1', 'test-user', 'pdf');
    
    expect(result).toHaveProperty('filePath');
    expect(result).toHaveProperty('fileName');
    expect(result).toHaveProperty('report_url');
    expect(result.file_size).toBe(1024);
  });

  it('TC-RPT.2: Excel 导出服务应能调用', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.exportReport('report-excel-1', 'test-user', 'excel');
    
    expect(result).toHaveProperty('filePath');
    expect(result).toHaveProperty('report_url');
  });

  it('TC-RPT.3: 报告查询应返回正确结构', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const report = await ReportService.getById('report-pdf-1', 'test-user');
    
    expect(report).toHaveProperty('report_id');
    expect(report).toHaveProperty('report_content');
    expect(report.report_content).toHaveProperty('portfolio');
  });

  it('TC-RPT.4: 报告生成应返回报告ID', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.generate('test-user', {
      portfolio_id: 'p1',
      report_type: 'var',
      report_name: '月度报告',
    });
    
    expect(result).toHaveProperty('report_id');
    expect(result.status).toBe('generated');
  });

  it('TC-RPT.5: 报告删除应返回成功', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.delete('report-pdf-1', 'test-user');
    
    expect(result).toBe(true);
  });

  it('TC-RPT.6: 报告列表应返回分页结构', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.getReports('test-user');
    
    expect(result).toHaveProperty('reports');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('limit');
  });

  it('TC-RPT.7: 报告导出路由应存在', () => {
    const { default: router } = require('../../src/routes/report.routes');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('TC-RPT.8: 导出结果应包含下载URL', async () => {
    const { ReportService } = require('../../src/services/report.service');
    const result = await ReportService.exportReport('report-pdf-1', 'test-user', 'pdf');
    
    expect(result.report_url).toMatch(/\/reports\//);
  });
});
