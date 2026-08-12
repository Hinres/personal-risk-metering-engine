/**
 * [PRME-VAR-002] report.controller 单元测试
 * 测试范围: getReports, generateReport, getReportById, deleteReport, exportReport
 * 最后更新: 2026-06-20
 */
import * as reportController from '../../src/controllers/report.controller';
import { ReportService } from '../../src/services/report.service';
import { AuditService } from '../../src/services/audit.service';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

jest.mock('../../src/services/report.service');
jest.mock('../../src/services/audit.service');
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('report.controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getReports', () => {
    it('should get reports', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (ReportService.getReports as jest.Mock).mockResolvedValue({ reports: [], total: 0, page: 1, limit: 10 });
      await reportController.getReports(req as any, res);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should get reports with default pagination', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (ReportService.getReports as jest.Mock).mockResolvedValue({ reports: [], total: 0, page: 1, limit: 10 });
      await reportController.getReports(req as any, res);
      expect(ReportService.getReports).toHaveBeenCalledWith('u1', undefined, 1, 10);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should handle errors', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (ReportService.getReports as jest.Mock).mockRejectedValue(new Error('fail'));
      await reportController.getReports(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'fail', 500);
    });
  });

  describe('generateReport', () => {
    it('should generate report', async () => {
      const req = mockReq({ portfolio_id: 'p1', report_type: 'var' });
      const res = mockRes();
      (ReportService.generate as jest.Mock).mockResolvedValue({ report_id: 'r1' });
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);
      await reportController.generateReport(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { report_id: 'r1' }, 'Report generated', 201);
    });

    it('should handle errors', async () => {
      const req = mockReq({});
      const res = mockRes();
      (ReportService.generate as jest.Mock).mockRejectedValue(new Error('fail'));
      await reportController.generateReport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'fail', 400);
    });

    // SIT-REP-001 修复测试：不传 report_name 时使用默认值
    it('should use default report_name when not provided (SIT-REP-001)', async () => {
      const req = mockReq({ portfolio_id: 'p1', report_type: 'var_analysis' });
      const res = mockRes();
      (ReportService.generate as jest.Mock).mockResolvedValue({ report_id: 'r1' });
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);
      await reportController.generateReport(req as any, res);
      expect(ReportService.generate).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          portfolio_id: 'p1',
          report_type: 'var_analysis',
          report_name: expect.stringMatching(/^VaR分析报告_\d{4}-\d{2}-\d{2}$/),
        }),
      );
      expect(successResponse).toHaveBeenCalledWith(res, { report_id: 'r1' }, 'Report generated', 201);
    });

    it('should fallback to "风险报告" for unknown report_type (SIT-REP-001)', async () => {
      const req = mockReq({ portfolio_id: 'p1', report_type: 'unknown_type' });
      const res = mockRes();
      (ReportService.generate as jest.Mock).mockResolvedValue({ report_id: 'r1' });
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);
      await reportController.generateReport(req as any, res);
      expect(ReportService.generate).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          portfolio_id: 'p1',
          report_type: 'unknown_type',
          report_name: expect.stringMatching(/^风险报告_\d{4}-\d{2}-\d{2}$/),
        }),
      );
      expect(successResponse).toHaveBeenCalledWith(res, { report_id: 'r1' }, 'Report generated', 201);
    });
  });

  describe('getReportById', () => {
    it('should get report by id', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (ReportService.getById as jest.Mock).mockResolvedValue({ report_id: 'r1' });
      await reportController.getReportById(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { report_id: 'r1' });
    });

    it('should handle not found', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (ReportService.getById as jest.Mock).mockRejectedValue(new Error('not found'));
      await reportController.getReportById(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('deleteReport', () => {
    it('should delete report', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (ReportService.getById as jest.Mock).mockResolvedValue({ report_id: 'r1', portfolio_id: 'p1', report_type: 'var' });
      (ReportService.delete as jest.Mock).mockResolvedValue(undefined);
      (AuditService.log as jest.Mock).mockResolvedValue(undefined);
      await reportController.deleteReport(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Report deleted');
    });

    it('should handle not found', async () => {
      const req = mockReq({}, { id: 'r1' });
      const res = mockRes();
      (ReportService.getById as jest.Mock).mockRejectedValue(new Error('not found'));
      await reportController.deleteReport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('exportReport', () => {
    it('should export report as pdf', async () => {
      const req = mockReq({}, { id: 'r1' }, { format: 'pdf' });
      const res = mockRes();
      (ReportService.exportReport as jest.Mock).mockResolvedValue({ report_url: 'http://test', file_size: 1024 });
      await reportController.exportReport(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ format: 'pdf' }));
    });

    it('should export report with default pdf format', async () => {
      const req = mockReq({}, { id: 'r1' }, {});
      const res = mockRes();
      (ReportService.exportReport as jest.Mock).mockResolvedValue({ report_url: 'http://test', file_size: 1024 });
      await reportController.exportReport(req as any, res);
      expect(ReportService.exportReport).toHaveBeenCalledWith('r1', 'u1', 'pdf');
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ format: 'pdf' }));
    });

    it('should reject invalid format', async () => {
      const req = mockReq({}, { id: 'r1' }, { format: 'txt' });
      const res = mockRes();
      await reportController.exportReport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'format must be pdf or excel', 400);
    });

    it('should handle errors', async () => {
      const req = mockReq({}, { id: 'r1' }, { format: 'pdf' });
      const res = mockRes();
      (ReportService.exportReport as jest.Mock).mockRejectedValue(new Error('fail'));
      await reportController.exportReport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'fail', 500);
    });
  });
});
