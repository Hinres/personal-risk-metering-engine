/**
 * [PRME-VAR-002] VaR分析和报告
 * 文件: report.controller.ts
 * 需求描述: VaR分析和报告功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { AuditService } from '../services/audit.service';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

export const getReports = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, portfolio_id } = req.query;
    const result = await ReportService.getReports(req.user.user_id, portfolio_id, parseInt(page), parseInt(limit));
    return paginatedResponse(res, result.reports, result.total, result.page, result.limit);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const generateReport = async (req: any, res: Response) => {
  try {
    // SIT-REP-001 修复：为 report_name 提供默认值，避免 NOT NULL 约束失败
    const body = { ...req.body };
    if (!body.report_name) {
      const typeNameMap: Record<string, string> = {
        risk_summary: '风险摘要报告',
        var_analysis: 'VaR分析报告',
        stress_test: '压力测试报告',
        portfolio_review: '组合回顾报告',
        compliance: '合规报告',
      };
      const dateStr = new Date().toISOString().slice(0, 10);
      body.report_name = `${typeNameMap[body.report_type] || '风险报告'}_${dateStr}`;
    }
    const report = await ReportService.generate(req.user.user_id, body);
    await AuditService.log('GENERATE', 'risk_reports', report.report_id, {
      portfolio_id: req.body.portfolio_id,
      report_type: req.body.report_type,
    }, { userId: req.user.user_id, ipAddress: req.ip });
    return successResponse(res, report, 'Report generated', 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getReportById = async (req: any, res: Response) => {
  try {
    const report = await ReportService.getById(req.params.id, req.user.user_id);
    return successResponse(res, report);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const deleteReport = async (req: any, res: Response) => {
  try {
    const report = await ReportService.getById(req.params.id, req.user.user_id);
    await ReportService.delete(req.params.id, req.user.user_id);
    await AuditService.log('DELETE', 'risk_reports', req.params.id, {
      portfolio_id: report.portfolio_id,
      report_type: report.report_type,
    }, { userId: req.user.user_id, ipAddress: req.ip });
    return successResponse(res, null, 'Report deleted');
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};

export const exportReport = async (req: any, res: Response) => {
  try {
    const { format = 'pdf' } = req.query;
    if (!['pdf', 'excel'].includes(format)) {
      return errorResponse(res, 'format must be pdf or excel', 400);
    }
    const result = await ReportService.exportReport(req.params.id, req.user.user_id, format);
    return successResponse(res, {
      download_url: result.report_url,
      file_size: result.file_size,
      format,
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
