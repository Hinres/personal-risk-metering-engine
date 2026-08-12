/**
 * [PRME-VAR-002] VaR分析和报告
 * 文件: report.service.ts
 * 需求描述: VaR分析和报告功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { Report } from '../models/Report';
import { VaRService } from './var.service';
import { PortfolioService } from './portfolio.service';
import logger from '../utils/logger';
import puppeteer, { Browser } from 'puppeteer';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const reportRepo = () => AppDataSource.getRepository(Report);
const REPORTS_DIR = path.join(process.cwd(), 'uploads', 'reports');

// Puppeteer 浏览器实例单例（延迟初始化，复用）
let browserInstance: Browser | null = null;

const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance || !browserInstance.connected) {
    if (browserInstance) {
      // 旧实例已断开，清理引用
      try { await browserInstance.close(); } catch (_) { /* ignore */ }
    }
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    logger.info('Puppeteer browser initialized');
  }
  return browserInstance;
};

export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Puppeteer browser closed');
  }
};

// 确保目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export class ReportService {
  static async getReports(userId: string, portfolioId?: string, page = 1, limit = 10) {
    const where: any = { user_id: userId };
    if (portfolioId) where.portfolio_id = portfolioId;
    const [reports, total] = await reportRepo().findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { reports, total, page, limit };
  }

  static async generate(userId: string, data: {
    portfolio_id: string;
    report_type: string;
    report_name: string;
    period_start?: Date;
    period_end?: Date;
  }) {
    // BUG-REP-001 双重保险：如果 report_name 为空或空白，自动生成默认值（不可变处理，避免副作用）
    const reportName = data.report_name?.trim() || (() => {
      const typeNameMap: Record<string, string> = {
        risk_summary: '风险摘要报告',
        var_analysis: 'VaR分析报告',
        stress_test: '压力测试报告',
        portfolio_review: '组合回顾报告',
        compliance: '合规报告',
      };
      const dateStr = new Date().toISOString().slice(0, 10);
      return `${typeNameMap[data.report_type] || '风险报告'}_${dateStr}`;
    })();

    const portfolio = await PortfolioService.getById(data.portfolio_id, userId);
    const latestVaR = await VaRService.getLatest(data.portfolio_id);
    
    const content = {
      portfolio: {
        name: portfolio.name,
        total_value: portfolio.statistics?.total_value || 0,
        holding_count: portfolio.holdings?.length || 0,
      },
      risk_summary: {
        var: latestVaR ? {
          value: latestVaR.var_value,
          percentage: latestVaR.var_percentage,
          confidence: latestVaR.confidence_level,
          method: latestVaR.calculation_type,
        } : null,
      },
      holdings: portfolio.holdings?.map((h: any) => ({
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        market_value: h.market_value,
        weight: h.weight,
        unrealized_pnl: h.unrealized_pnl,
      })) || [],
      generated_at: new Date(),
    };

    const report = reportRepo().create({
      portfolio_id: data.portfolio_id,
      user_id: userId,
      report_name: reportName,
      report_type: data.report_type,
      period_start: data.period_start || null,
      period_end: data.period_end || null,
      report_content: content,
      status: 'generated',
      generated_at: new Date(),
    });
    await reportRepo().save(report);
    return report;
  }

  static async getById(id: string, userId: string) {
    const report = await reportRepo().findOne({ where: { report_id: id, user_id: userId } });
    if (!report) throw new Error('Report not found');
    return report;
  }

  static async delete(id: string, userId: string) {
    const report = await reportRepo().findOne({ where: { report_id: id, user_id: userId } });
    if (!report) throw new Error('Report not found');
    report.status = 'deleted';
    await reportRepo().save(report);
    return true;
  }

  /**
   * 导出报告为 PDF 或 Excel
   */
  static async exportReport(id: string, userId: string, format: 'pdf' | 'excel' = 'pdf') {
    const report = await this.getById(id, userId);
    const content = report.report_content;
    const fileName = `${report.report_id}_${format}_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const filePath = path.join(REPORTS_DIR, fileName);

    if (format === 'pdf') {
      await this.generatePdf(content, filePath);
    } else {
      await this.generateExcel(content, filePath);
    }

    const stats = fs.statSync(filePath);
    report.report_url = `/reports/${fileName}`;
    report.file_format = format === 'pdf' ? 'pdf' : 'xlsx';
    report.file_size = stats.size;
    await reportRepo().save(report);

    return { filePath, fileName, report_url: report.report_url, file_size: stats.size };
  }

  /**
   * 使用 Puppeteer 生成 PDF
   */
  private static async generatePdf(content: any, filePath: string) {
    const html = this.buildReportHtml(content);
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html);
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
    } finally {
      await page.close();
    }
  }

  /**
   * 使用 ExcelJS 生成 Excel
   */
  private static async generateExcel(content: any, filePath: string) {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('组合概览');
    summarySheet.addRow(['组合名称', content.portfolio?.name || '']);
    summarySheet.addRow(['总市值', content.portfolio?.total_value || 0]);
    summarySheet.addRow(['持仓数量', content.portfolio?.holding_count || 0]);
    summarySheet.addRow([]);
    summarySheet.addRow(['VaR 值', content.risk_summary?.var?.value || 'N/A']);
    summarySheet.addRow(['VaR 百分比', content.risk_summary?.var?.percentage || 'N/A']);
    summarySheet.addRow(['置信度', content.risk_summary?.var?.confidence || 'N/A']);
    summarySheet.addRow(['计算方法', content.risk_summary?.var?.method || 'N/A']);

    const holdingsSheet = workbook.addWorksheet('持仓明细');
    holdingsSheet.addRow(['代码', '名称', '数量', '市值', '权重', '未实现盈亏']);
    const holdings = content.holdings || [];
    for (const h of holdings) {
      holdingsSheet.addRow([
        h.symbol, h.name, h.quantity, h.market_value, h.weight, h.unrealized_pnl,
      ]);
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private static buildReportHtml(content: any): string {
    const holdings = content.holdings || [];
    const varData = content.risk_summary?.var;
    const holdingsRows = holdings.map((h: any) => `
      <tr>
        <td>${h.symbol}</td>
        <td>${h.name}</td>
        <td>${h.quantity}</td>
        <td>${h.market_value}</td>
        <td>${(h.weight !== null && h.weight !== undefined ? (h.weight * 100).toFixed(2) : '0.00')}%</td>
        <td>${h.unrealized_pnl}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Microsoft YaHei", sans-serif; padding: 20px; color: #333; }
  h1 { color: #1a1a2e; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
  h2 { color: #2c3e50; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background-color: #1a1a2e; color: white; }
  .summary-box { background: #f5f6fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
  .summary-item { margin: 8px 0; }
</style>
</head>
<body>
  <h1>投资组合风险报告</h1>
  <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>

  <h2>组合概览</h2>
  <div class="summary-box">
    <div class="summary-item"><strong>组合名称：</strong>${content.portfolio?.name || '-'}</div>
    <div class="summary-item"><strong>总市值：</strong>¥${(content.portfolio?.total_value || 0).toFixed(2)}</div>
    <div class="summary-item"><strong>持仓数量：</strong>${content.portfolio?.holding_count || 0}</div>
  </div>

  <h2>风险摘要</h2>
  <div class="summary-box">
    <div class="summary-item"><strong>VaR 值：</strong>${varData ? '¥' + varData.value?.toFixed(2) : 'N/A'}</div>
    <div class="summary-item"><strong>VaR 百分比：</strong>${varData ? (varData.percentage !== null && varData.percentage !== undefined ? varData.percentage.toFixed(2) : 'N/A') + '%' : 'N/A'}</div>
    <div class="summary-item"><strong>置信度：</strong>${varData ? (varData.confidence * 100).toFixed(0) + '%' : 'N/A'}</div>
    <div class="summary-item"><strong>计算方法：</strong>${varData?.method || 'N/A'}</div>
  </div>

  <h2>持仓明细</h2>
  <table>
    <thead>
      <tr>
        <th>代码</th><th>名称</th><th>数量</th><th>市值</th><th>权重</th><th>未实现盈亏</th>
      </tr>
    </thead>
    <tbody>
      ${holdingsRows || '<tr><td colspan="6" style="text-align:center;">无持仓数据</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }
}
