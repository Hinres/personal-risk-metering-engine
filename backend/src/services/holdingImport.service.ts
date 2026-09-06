/**
 * [PRME-v1.3-PA-004] 持仓批量导入
 * 文件: holdingImport.service.ts
 * 需求描述: Excel/CSV 持仓批量解析、校验与导入
 * 最后更新: 2026-09-06（DEF-V13-001：purchase_date 兼容 Date 对象）
 */
import { AppDataSource } from '../config/database';
import { HoldingImportTask } from '../models/HoldingImportTask';
import { HoldingImportRow } from '../models/HoldingImportRow';
import { Holding } from '../models/Holding';
import { Portfolio } from '../models/Portfolio';
import { PortfolioService } from './portfolio.service';
import { VaRService } from './var.service';
import { StressService } from './stress.service';
import ExcelJS from 'exceljs';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

const taskRepo = () => AppDataSource.getRepository(HoldingImportTask);
const rowRepo = () => AppDataSource.getRepository(HoldingImportRow);
const holdingRepo = () => AppDataSource.getRepository(Holding);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

interface ParsedRow {
  rowNumber: number;
  symbol: string;
  name?: string;
  quantity: number;
  cost_price: number;
  purchase_date?: string;
  exchange?: string;
  sector?: string;
  market?: string;
  remark?: string;
  errors: FieldError[];
}

interface FieldError {
  field: string;
  value: string;
  reason: string;
}

interface ImportResult {
  success: boolean;
  task_id: string;
  portfolio_id: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  imported_count: number;
  status: string;
  errors?: { row: number; field: string; value: string; reason: string }[];
}

const FIELD_ALIASES: Record<string, string[]> = {
  symbol: ['股票代码', 'code', 'stock_code', 'symbol'],
  name: ['股票名称', 'stock_name', 'name'],
  quantity: ['持仓数量', 'quantity', 'amount', 'shares'],
  cost_price: ['成本价', 'cost_price', 'cost', 'average_cost'],
  purchase_date: ['持仓日期', 'purchase_date', 'date', 'buy_date'],
  exchange: ['交易所', 'exchange'],
  sector: ['行业', 'sector'],
  market: ['市场', 'market'],
  remark: ['备注', 'remark'],
};

export class HoldingImportService {
  static async importFromFile(
    portfolioId: string,
    userId: string,
    file: Express.Multer.File
  ): Promise<ImportResult> {
    const portfolio = await portfolioRepo().findOne({
      where: { portfolio_id: portfolioId, user_id: userId },
    });
    if (!portfolio) throw new Error('Portfolio not found');

    const format = path.extname(file.originalname).toLowerCase() === '.csv' ? 'csv' : 'xlsx';
    const rows = await this.parseFile(file, format);

    // B-01: 单次导入上限 100 条（PRD 2.5.4）
    const MAX_IMPORT_ROWS = 100;
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`单次导入上限为 ${MAX_IMPORT_ROWS} 条，当前 ${rows.length} 条`);
    }

    const task = taskRepo().create({
      portfolio_id: portfolioId,
      user_id: userId,
      file_name: file.originalname,
      file_path: file.path,
      file_size: file.size,
      format,
      total_rows: rows.length,
      status: 'processing',
    });
    await taskRepo().save(task);

    const parsedRows = rows.map((row, idx) => this.parseAndValidateRow(row, idx + 2));
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    const errorRows = parsedRows.filter(r => r.errors.length > 0);

    // 保存行记录
    for (const r of parsedRows) {
      const rawRow = rows[r.rowNumber - 2] || {};
      const rowEntity = rowRepo().create({
        task_id: task.task_id,
        row_number: r.rowNumber,
        raw_data: JSON.stringify(rawRow),
        parsed_data: JSON.stringify(r),
        is_valid: r.errors.length === 0,
        error_fields: r.errors.length ? JSON.stringify(r.errors) : null,
      });
      await rowRepo().save(rowEntity);
    }

    if (errorRows.length > 0) {
      task.valid_rows = validRows.length;
      task.error_rows = errorRows.length;
      task.status = 'failed';
      task.error_message = JSON.stringify(errorRows.flatMap(r => r.errors));
      await taskRepo().save(task);

      return {
        success: false,
        task_id: task.task_id,
        portfolio_id: portfolioId,
        total_rows: rows.length,
        valid_rows: validRows.length,
        error_rows: errorRows.length,
        imported_count: 0,
        status: 'failed',
        errors: errorRows.flatMap(r => r.errors.map(e => ({
          row: r.rowNumber,
          field: e.field,
          value: e.value,
          reason: e.reason,
        }))),
      };
    }

    // 导入有效行
    let importedCount = 0;
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const r of validRows) {
        const holding = holdingRepo().create({
          portfolio_id: portfolioId,
          symbol: r.symbol,
          name: r.name || r.symbol,
          quantity: r.quantity,
          cost_price: r.cost_price,
          security_type: 'stock',
          exchange: r.exchange || this.inferExchange(r.symbol),
          sector: r.sector || null,
          currency: 'CNY',
          status: 'active',
          metadata: {
            purchase_date: r.purchase_date,
            market: r.market,
            remark: r.remark,
            import_task_id: task.task_id,
          },
        });
        await queryRunner.manager.save(holding);
        importedCount++;
      }

      await queryRunner.commitTransaction();
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      logger.error('Holding import transaction failed', { error: error.message });
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 更新组合统计
    await PortfolioService.updateStatistics(portfolioId);

    // 异步触发 VaR 计算（不等待）
    this.triggerRiskCalculations(portfolioId, task.user_id).catch(e =>
      logger.error('Import triggered risk calc failed', { error: e.message })
    );

    task.valid_rows = validRows.length;
    task.error_rows = 0;
    task.status = 'completed';
    task.completed_at = new Date();
    task.triggered_var = true;
    task.triggered_stress = true;
    await taskRepo().save(task);

    return {
      success: true,
      task_id: task.task_id,
      portfolio_id: portfolioId,
      total_rows: rows.length,
      valid_rows: validRows.length,
      error_rows: 0,
      imported_count: importedCount,
      status: 'completed',
    };
  }

  static async getTaskById(taskId: string, userId: string) {
    const task = await taskRepo().findOne({
      where: { task_id: taskId, user_id: userId },
    });
    if (!task) throw new Error('Task not found');

    const errorRows = await rowRepo().find({
      where: { task_id: taskId, is_valid: false },
      order: { row_number: 'ASC' },
    });

    return {
      task_id: task.task_id,
      portfolio_id: task.portfolio_id,
      file_name: task.file_name,
      format: task.format,
      total_rows: task.total_rows,
      valid_rows: task.valid_rows,
      error_rows: task.error_rows,
      status: task.status,
      triggered_var: task.triggered_var,
      triggered_stress: task.triggered_stress,
      created_at: task.created_at,
      completed_at: task.completed_at,
      errors: errorRows.map(r => ({
        row: r.row_number,
        ...JSON.parse(r.error_fields || '[]'),
      })),
    };
  }

  private static async parseFile(file: Express.Multer.File, format: 'xlsx' | 'csv'): Promise<Record<string, any>[]> {
    const workbook = new ExcelJS.Workbook();
    if (format === 'csv') {
      await workbook.csv.read(fs.createReadStream(file.path));
    } else {
      await workbook.xlsx.readFile(file.path);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Cannot read worksheet');

    const rows: Record<string, any>[] = [];
    const headerRow = worksheet.getRow(1).values as any[];
    const headers = headerRow.slice(1).map(h => String(h || '').trim());
    const normalizedHeaders = headers.map(h => this.normalizeFieldName(h));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as any[];
      const record: Record<string, any> = {};
      normalizedHeaders.forEach((key, idx) => {
        if (key) record[key] = values[idx + 1];
      });
      rows.push(record);
    });

    return rows;
  }

  private static normalizeFieldName(name: string): string | null {
    const lower = String(name || '').toLowerCase().trim();
    for (const [standard, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(lower) || standard === lower) return standard;
    }
    return null;
  }

  private static parseAndValidateRow(raw: Record<string, any>, rowNumber: number): ParsedRow {
    const errors: FieldError[] = [];
    const symbol = String(raw.symbol || '').trim();
    const name = raw.name ? String(raw.name).trim() : undefined;
    const quantity = this.parseNumber(raw.quantity);
    const costPrice = this.parseNumber(raw.cost_price);
    const purchaseDate = this.parsePurchaseDate(raw.purchase_date);

    if (!symbol) errors.push({ field: 'symbol', value: '', reason: '股票代码不能为空' });
    if (quantity === null || quantity <= 0) errors.push({ field: 'quantity', value: String(raw.quantity || ''), reason: '持仓数量必须大于0' });
    if (costPrice === null || costPrice <= 0) errors.push({ field: 'cost_price', value: String(raw.cost_price || ''), reason: '成本价必须大于0' });
    if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      errors.push({ field: 'purchase_date', value: String(purchaseDate), reason: '持仓日期格式必须为 YYYY-MM-DD' });
    }

    return {
      rowNumber,
      symbol,
      name,
      quantity: quantity ?? 0,
      cost_price: costPrice ?? 0,
      purchase_date: purchaseDate,
      exchange: raw.exchange ? String(raw.exchange).trim() : undefined,
      sector: raw.sector ? String(raw.sector).trim() : undefined,
      market: raw.market ? String(raw.market).trim() : undefined,
      remark: raw.remark ? String(raw.remark).trim() : undefined,
      errors,
    };
  }

  /**
   * DEF-V13-001：ExcelJS 解析 CSV 时会把日期样式单元格转为 Date 对象，
   * String(date) 得到 "Thu Jan 15 2026 00:00:00 GMT+0800 ..." 导致正则校验失败。
   * 此处对 Date 对象格式化为 YYYY-MM-DD，字符串走原有 trim 逻辑。
   */
  private static parsePurchaseDate(value: any): string | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return String(value);
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(value).trim();
  }

  private static parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : null;
  }

  private static inferExchange(symbol: string): string {
    const s = symbol.trim();
    if (s.startsWith('6')) return 'SH';
    if (s.startsWith('0') || s.startsWith('3')) return 'SZ';
    if (s.startsWith('8') || s.startsWith('4')) return 'BJ';
    return 'SH';
  }

  private static async triggerRiskCalculations(portfolioId: string, userId: string) {
    // 异步触发 VaR 计算
    try {
      await VaRService.calculate(userId, portfolioId, {
        confidence_level: 0.95,
        time_horizon: 1,
        method: 'historical',
      });
    } catch (e: any) {
      logger.warn('Import triggered VaR failed', { error: e.message });
    }

    // B-02: 导入成功后自动触发压力测试
    try {
      await StressService.runStressTest(userId, portfolioId, '2008_financial_crisis');
    } catch (e: any) {
      logger.warn('Import triggered stress test failed', { error: e.message });
    }
  }
}
