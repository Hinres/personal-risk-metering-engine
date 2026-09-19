/**
 * [PRME-PA-004] holdingImport.service 单元测试
 * 测试范围: 单次导入 100 条上限、导入后触发 VaR/压力测试、CSV 代码前导零保护
 * 最后更新: 2026-09-08（DEF-V13-003）
 */
import { AppDataSource } from '../../src/config/database';
import { HoldingImportService } from '../../src/services/holdingImport.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { VaRService } from '../../src/services/var.service';
import { StressService } from '../../src/services/stress.service';
import { User } from '../../src/models/User';
import { Portfolio } from '../../src/models/Portfolio';
import { Holding } from '../../src/models/Holding';
import { HoldingImportTask } from '../../src/models/HoldingImportTask';
import { HoldingImportRow } from '../../src/models/HoldingImportRow';
import fs from 'fs';

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
  const mockSymbol = (n: number) =>
    (global as any).__TEST_SYMBOL_FACTORY__ ? (global as any).__TEST_SYMBOL_FACTORY__(n) : `00000${n}`;

  const getHeaders = () =>
    (global as any).__TEST_HEADERS__ || ['symbol', 'quantity', 'cost_price'];

  const getRowValues = (n: number) => {
    // F-02 测试可注入完整行数据（__TEST_ROWS__[n-2]），否则走默认工厂
    const customRows = (global as any).__TEST_ROWS__;
    if (customRows && customRows[n - 2]) return [null, ...customRows[n - 2]];
    return [null, mockSymbol(n), n * 100, 10];
  };

  const rowCount = () =>
    ((global as any).__TEST_ROWS__ && (global as any).__TEST_ROWS__.length) || (global as any).__TEST_ROW_COUNT__ || 1;

  const mockWorksheet = (_rowCount: number) => ({
    getRow: (n: number) => {
      if (n === 1) return { values: [null, ...getHeaders()] };
      return { values: getRowValues(n) };
    },
    eachRow: (cb: (row: any, rowNumber: number) => void) => {
      for (let i = 2; i <= rowCount() + 1; i++) {
        cb({ values: getRowValues(i) }, i);
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

  // DEF-V13-003：ExcelJS 解析 CSV 时把纯数字代码转为 number（"000001" → 1），
  // 落库 symbol 前导零丢失且交易所推断错误。
  it('DEF-V13-003: CSV 纯数字代码（number 类型）应补足 6 位前导零并正确推断交易所', async () => {
    // 模拟 ExcelJS 行为：symbol 列以 number 返回（"000001" → 1，"002594" → 2594）
    const symbols = [1, 2594];
    let callIdx = 0;
    (global as any).__TEST_SYMBOL_FACTORY__ = () => symbols[callIdx++ % symbols.length];
    (global as any).__TEST_ROW_COUNT__ = 2;
    // csv 格式路径会真实 createReadStream(file.path)，需准备一个真实文件
    fs.writeFileSync('/tmp/test-def-v13-003.csv', 'symbol,quantity,cost_price\n');

    const result = await HoldingImportService.importFromFile(portfolioId, userId, {
      ...makeFile('test.csv'),
      path: '/tmp/test-def-v13-003.csv',
    });

    expect(result.success).toBe(true);
    expect(result.imported_count).toBe(2);

    const holdingRepo = AppDataSource.getRepository(Holding);
    const imported = await holdingRepo.find({ where: { portfolio_id: portfolioId } });
    const byTask = imported.filter(h => h.metadata?.import_task_id === result.task_id);
    expect(byTask.map(h => h.symbol).sort()).toEqual(['000001', '002594']);
    // 交易所推断：000xxx/002xxx/300xxx → SZ
    expect(byTask.map(h => h.exchange).sort()).toEqual(['SZ', 'SZ']);

    // 清理本用例导入的持仓，避免影响其他用例
    await holdingRepo.delete(byTask.map(h => ({ holding_id: h.holding_id })));
    (global as any).__TEST_SYMBOL_FACTORY__ = undefined;
    fs.unlinkSync('/tmp/test-def-v13-003.csv');
  });

  // ── F-02（2026-09-18）：部分成功语义 ──
  describe('F-02 partial 语义', () => {
    const HEADERS = ['symbol', 'quantity', 'cost_price', 'purchase_date'];

    afterEach(async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const taskRepo = AppDataSource.getRepository(HoldingImportTask);
      const rowRepo = AppDataSource.getRepository(HoldingImportRow);
      const tasks = await taskRepo.find({ where: { portfolio_id: portfolioId } });
      for (const t of tasks) {
        await rowRepo.delete({ task_id: t.task_id });
        await holdingRepo.delete({ metadata: { import_task_id: t.task_id } } as any);
        await taskRepo.delete({ task_id: t.task_id });
      }
      (global as any).__TEST_ROWS__ = undefined;
      (global as any).__TEST_HEADERS__ = undefined;
    });

    it('F-02-1: 混合行（2 有效 + 1 无效）→ status=partial，有效行入库，行号正确', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [
        ['600519', 100, 1680, '2026-01-15'],
        ['000001', -5, 10, '2026-02-01'],            // 第 3 行：数量非法
        ['600276', 200, 45.5, '2026/13/45'],         // 第 4 行：日期非法
      ];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('partial.xlsx'));

      expect(result.success).toBe(true);
      expect(result.status).toBe('partial');
      expect(result.total_rows).toBe(3);
      expect(result.imported_count).toBe(1);
      expect(result.failed_count).toBe(2);
      expect(result.error_rows).toBe(2);
      expect(result.errors).toBeDefined();
      // 行号 = Excel 实际行号（含表头，从 2 起）
      expect(result.errors!.map(e => e.row).sort((a, b) => a - b)).toEqual([3, 4]);
      expect(result.errors!.map(e => e.field).sort()).toEqual(['purchase_date', 'quantity']);

      // 仅有效行落库
      const holdingRepo = AppDataSource.getRepository(Holding);
      const holdings = await holdingRepo.find({ where: { portfolio_id: portfolioId } });
      const byTask = holdings.filter(h => h.metadata?.import_task_id === result.task_id);
      expect(byTask).toHaveLength(1);
      expect(byTask[0].symbol).toBe('600519');
    });

    it('F-02-2: created_holding_id 回填到行记录', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', 100, 1680, '2026-01-15']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('one.xlsx'));

      const rowRepo = AppDataSource.getRepository(HoldingImportRow);
      const rows = await rowRepo.find({ where: { task_id: result.task_id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].created_holding_id).not.toBeNull();

      const holdingRepo = AppDataSource.getRepository(Holding);
      const holding = await holdingRepo.findOne({ where: { holding_id: rows[0].created_holding_id! } });
      expect(holding).not.toBeNull();
      expect(holding!.symbol).toBe('600519');
    });

    it('F-02-3: 全无效 → status=failed，无任何持仓产生', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [
        ['600519', -1, 1680, '2026-01-15'],
        ['000001', 0, 10, '2026-02-01'],
      ];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('all-invalid.xlsx'));

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.imported_count).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      const holdingRepo = AppDataSource.getRepository(Holding);
      const holdings = await holdingRepo.find({ where: { portfolio_id: portfolioId } });
      expect(holdings.filter(h => h.metadata?.import_task_id === result.task_id)).toHaveLength(0);
    });

    it('F-02-4: 全有效 → status=completed，响应保持兼容（failed_count=0）', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [
        ['600519', 100, 1680, '2026-01-15'],
        ['600276', 200, 45.5, '2026-03-01'],
      ];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('all-valid.xlsx'));

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.imported_count).toBe(2);
      expect(result.failed_count).toBe(0);
      // 全有效不附带 errors（与现行结构一致）
      expect(result.errors).toBeUndefined();
    });
  });

  // ── V2-07（2026-09-19）：CSV 行校验收紧 ──
  describe('V2-07 行校验收紧', () => {
    const HEADERS = ['symbol', 'quantity', 'cost_price', 'purchase_date'];

    afterEach(async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const taskRepo = AppDataSource.getRepository(HoldingImportTask);
      const rowRepo = AppDataSource.getRepository(HoldingImportRow);
      const tasks = await taskRepo.find({ where: { portfolio_id: portfolioId } });
      for (const t of tasks) {
        await rowRepo.delete({ task_id: t.task_id });
        await holdingRepo.delete({ metadata: { import_task_id: t.task_id } } as any);
        await taskRepo.delete({ task_id: t.task_id });
      }
      (global as any).__TEST_ROWS__ = undefined;
      (global as any).__TEST_HEADERS__ = undefined;
    });

    it('V2-07-1: 2024-13-45（13月）应行级拒绝：不是有效日历日期', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', 100, 1680, '2024-13-45']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('bad-month.xlsx'));

      expect(result.status).toBe('failed');
      expect(result.imported_count).toBe(0);
      expect(result.errors![0]).toMatchObject({ field: 'purchase_date', reason: '持仓日期不是有效日历日期' });
    });

    it('V2-07-2: 2024-02-29（闰日）合法导入不受影响', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', 100, 1680, '2024-02-29']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('leap-day.xlsx'));

      expect(result.status).toBe('completed');
      expect(result.imported_count).toBe(1);
    });

    it('V2-07-3: 未来日期应行级拒绝', async () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const futureStr = `${future.getFullYear()}-06-01`;
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', 100, 1680, futureStr]];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('future-date.xlsx'));

      expect(result.status).toBe('failed');
      expect(result.errors![0]).toMatchObject({ field: 'purchase_date', reason: '持仓日期不能晚于今天' });
    });

    it('V2-07-4: 字母代码 ABC123 应行级拒绝', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['ABC123', 100, 1680, '2026-01-15']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('bad-symbol.xlsx'));

      expect(result.status).toBe('failed');
      expect(result.errors![0]).toMatchObject({ field: 'symbol', reason: '股票代码格式不正确（须为 6 位数字）' });
    });
  });

  // ── V2-08（2026-09-19）：任务详情 errors 结构修复 ──
  describe('V2-08 getTaskById errors 结构', () => {
    const HEADERS = ['symbol', 'quantity', 'cost_price', 'purchase_date'];

    afterEach(async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const taskRepo = AppDataSource.getRepository(HoldingImportTask);
      const rowRepo = AppDataSource.getRepository(HoldingImportRow);
      const tasks = await taskRepo.find({ where: { portfolio_id: portfolioId } });
      for (const t of tasks) {
        await rowRepo.delete({ task_id: t.task_id });
        await holdingRepo.delete({ metadata: { import_task_id: t.task_id } } as any);
        await taskRepo.delete({ task_id: t.task_id });
      }
      (global as any).__TEST_ROWS__ = undefined;
      (global as any).__TEST_HEADERS__ = undefined;
    });

    it('V2-08-1: 单行错误返回数组结构 [{row, field, value, reason}]（不再出现 {"0":...} 展开）', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', -1, 1680, '2026-01-15']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('one-err.xlsx'));
      const detail = await HoldingImportService.getTaskById(result.task_id, userId);

      expect(Array.isArray(detail.errors)).toBe(true);
      expect(detail.errors).toHaveLength(1);
      expect(detail.errors[0]).toMatchObject({ row: 2, field: 'quantity' });
      expect(detail.errors[0]).toHaveProperty('reason');
      expect(detail.errors[0]).not.toHaveProperty('0');
    });

    it('V2-08-2: 一行多错误应展开为独立多条（与导入响应 errors 同构）', async () => {
      (global as any).__TEST_HEADERS__ = HEADERS;
      (global as any).__TEST_ROWS__ = [['600519', -1, -5, '2024-13-45']];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('multi-err.xlsx'));
      const detail = await HoldingImportService.getTaskById(result.task_id, userId);

      expect(detail.errors).toHaveLength(3);
      expect(detail.errors.map(e => e.field).sort()).toEqual(['cost_price', 'purchase_date', 'quantity']);
      expect(detail.errors.every(e => e.row === 2)).toBe(true);
    });
  });

  // ── F-01（2026-09-18）：purchase_date 列持久化 ──
  describe('F-01 purchase_date 列', () => {
    afterEach(async () => {
      const holdingRepo = AppDataSource.getRepository(Holding);
      const taskRepo = AppDataSource.getRepository(HoldingImportTask);
      const rowRepo = AppDataSource.getRepository(HoldingImportRow);
      const tasks = await taskRepo.find({ where: { portfolio_id: portfolioId } });
      for (const t of tasks) {
        await rowRepo.delete({ task_id: t.task_id });
        await holdingRepo.delete({ metadata: { import_task_id: t.task_id } } as any);
        await taskRepo.delete({ task_id: t.task_id });
      }
      (global as any).__TEST_ROWS__ = undefined;
      (global as any).__TEST_HEADERS__ = undefined;
    });

    it('F-01-1: 导入含日期 CSV → holdings.purchase_date 列非空且值正确（非仅 metadata）', async () => {
      (global as any).__TEST_HEADERS__ = ['symbol', 'quantity', 'cost_price', 'purchase_date'];
      (global as any).__TEST_ROWS__ = [
        ['600519', 100, 1680, '2026-01-15'],
        ['600276', 200, 45.5, '2026-03-01'],
      ];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('with-date.xlsx'));
      expect(result.success).toBe(true);

      const holdingRepo = AppDataSource.getRepository(Holding);
      const holdings = await holdingRepo.find({ where: { portfolio_id: portfolioId } });
      const byTask = holdings.filter(h => h.metadata?.import_task_id === result.task_id);
      expect(byTask).toHaveLength(2);

      const toStr = (v: any) => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v).slice(0, 10);
      };
      const bySymbol = new Map(byTask.map(h => [h.symbol, h]));
      // 断言独立列（purchase_date），而非 metadata
      expect(toStr(bySymbol.get('600519')!.purchase_date)).toBe('2026-01-15');
      expect(toStr(bySymbol.get('600276')!.purchase_date)).toBe('2026-03-01');
    });

    it('F-01-2: 无日期行 → purchase_date 为 null 且不报错', async () => {
      (global as any).__TEST_HEADERS__ = ['symbol', 'quantity', 'cost_price'];
      (global as any).__TEST_ROWS__ = [['600519', 100, 1680]];

      const result = await HoldingImportService.importFromFile(portfolioId, userId, makeFile('no-date.xlsx'));
      expect(result.success).toBe(true);

      const holdingRepo = AppDataSource.getRepository(Holding);
      const holding = (await holdingRepo.find({ where: { portfolio_id: portfolioId } }))
        .find(h => h.metadata?.import_task_id === result.task_id);
      expect(holding).toBeDefined();
      expect(holding!.purchase_date === null || holding!.purchase_date === undefined).toBe(true);
    });
  });
});
