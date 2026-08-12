/**
 * [PRME-VAR-002] report.service 初始化分支覆盖
 * 文件: report.service.init.test.ts
 * 测试范围: 顶级 REPORTS_DIR 已存在时不调用 mkdirSync 的分支
 * 最后更新: 2026-07-27
 */

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ size: 2048 }),
  };
});

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    connected: true,
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('exceljs', () => {
  const mockWorksheet = { addRow: jest.fn() };
  const mockWorkbook = {
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: { writeFile: jest.fn().mockResolvedValue(undefined) },
  };
  return {
    __esModule: true,
    default: { Workbook: jest.fn().mockImplementation(() => mockWorkbook) },
  };
});

jest.mock('../../src/services/portfolio.service', () => ({
  PortfolioService: {},
}));

jest.mock('../../src/services/var.service', () => ({
  VaRService: {},
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

describe('report.service initialization when reports dir exists', () => {
  it('should not call mkdirSync when reports dir exists', () => {
    const fs = require('fs');
    const { ReportService } = require('../../src/services/report.service');
    expect(ReportService).toBeDefined();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});
