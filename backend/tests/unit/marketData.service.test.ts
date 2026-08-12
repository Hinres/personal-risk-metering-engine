/**
 * [PRME-INFRA-004] marketData.service 单元测试
 * 文件: marketData.service.test.ts
 * 测试范围: getLatestPrice, getHistory, getReturnsMatrix, getStockBasic, getDailyQuote, syncFromTushare, getTrackedSymbols, saveMarketData, toTsCode, exchangeFromSymbol
 * 最后更新: 2026-06-25
 */

// 必须在模块加载前设置环境变量
process.env.TUSHARE_TOKEN = '***';

import { MarketDataService } from '../../src/services/marketData.service';
import { AppDataSource } from '../../src/config/database';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
});

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('MarketDataService', () => {
  let marketRepo: ReturnType<typeof mockRepo>;
  let holdingRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    marketRepo = mockRepo();
    holdingRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'MarketData' || name?.includes('Market')) return marketRepo;
      if (name === 'Holding' || name?.includes('Holding')) return holdingRepo;
      return mockRepo();
    });
    // 恢复环境变量（可能被 MD-006/MD-011/MD-017 删除）
    process.env.TUSHARE_TOKEN = '***';
    mockedAxios.post.mockResolvedValue({ data: {} } as any);
    mockedAxios.get.mockResolvedValue({ data: {} } as any);
  });

  // ── getLatestPrice ──
  describe('getLatestPrice', () => {
    it('MD-001: 应返回最新收盘价', async () => {
      marketRepo.findOne.mockResolvedValue({ close_price: 12.5, trade_date: '2026-06-01' });
      const result = await MarketDataService.getLatestPrice('000001.SZ');
      expect(result).toBe(12.5);
    });

    it('MD-002: 无数据时应返回 null', async () => {
      marketRepo.findOne.mockResolvedValue(null);
      const result = await MarketDataService.getLatestPrice('000001.SZ');
      expect(result).toBeNull();
    });
  });

  // ── getHistory ──
  describe('getHistory', () => {
    it('MD-003: 应返回历史数据', async () => {
      const mockData = [
        { trade_date: '2026-06-25', close_price: 12 },
        { trade_date: '2026-06-24', close_price: 11 },
      ];
      marketRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockData),
      });

      const result = await MarketDataService.getHistory('000001.SZ', 30);
      expect(result.length).toBe(2);
    });
  });

  // ── getReturnsMatrix ──
  describe('getReturnsMatrix', () => {
    it('MD-004: 应返回收益率矩阵', async () => {
      const mockData = [
        { close_price: 10, trade_date: '2026-06-01' },
        { close_price: 11, trade_date: '2026-06-02' },
        { close_price: 10.5, trade_date: '2026-06-03' },
      ];
      marketRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockData),
      });

      const result = await MarketDataService.getReturnsMatrix(['000001.SZ', '000002.SZ'], 5);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].length).toBe(2);
    });

    it('MD-005: 数据不足时应抛错', async () => {
      marketRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await expect(MarketDataService.getReturnsMatrix(['000001.SZ'], 5))
        .rejects.toThrow('Insufficient historical data');
    });
  });

  // ── getStockBasic ──
  describe('getStockBasic', () => {
    it('MD-006: 无 token 时应返回空数组', async () => {
      delete (process.env as any).TUSHARE_TOKEN;
      const result = await MarketDataService.getStockBasic();
      expect(result).toEqual([]);
    });

    it('MD-007: API 成功时应返回股票列表', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          data: {
            fields: ['ts_code', 'name', 'industry'],
            items: [
              ['000001.SZ', '平安银行', '银行'],
              ['000002.SZ', '万科A', '房地产'],
            ],
          },
        },
      } as any);

      const result = await MarketDataService.getStockBasic();
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('ts_code', '000001.SZ');
      expect(result[0]).toHaveProperty('name', '平安银行');
    });

    it('MD-008: API 返回无 data 时应返回空数组', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} } as any);
      const result = await MarketDataService.getStockBasic();
      expect(result).toEqual([]);
    });

    it('MD-009: API 失败时应返回空数组并记录日志', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error') as any);
      const result = await MarketDataService.getStockBasic();
      expect(result).toEqual([]);
    });
  });

  // ── getDailyQuote ──
  describe('getDailyQuote', () => {
    it('MD-010: 应获取日线行情', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          data: {
            fields: ['ts_code', 'trade_date', 'close', 'vol'],
            items: [
              ['000001.SZ', '20260601', 12, 1000],
              ['000001.SZ', '20260602', 13, 2000],
            ],
          },
        },
      } as any);

      const result = await MarketDataService.getDailyQuote('000001.SZ', '20260101', '20260601');
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('close', 12);
    });

    it('MD-011: 无 token 时应返回空数组', async () => {
      delete (process.env as any).TUSHARE_TOKEN;
      const result = await MarketDataService.getDailyQuote('000001.SZ');
      expect(result).toEqual([]);
    });
  });

  // ── toTsCode / fromTsCode / exchangeFromSymbol ──
  describe('symbol helpers', () => {
    it('MD-012: toTsCode 上海', () => {
      expect((MarketDataService as any).toTsCode('600519')).toBe('600519.SH');
    });

    it('MD-013: toTsCode 深圳', () => {
      expect((MarketDataService as any).toTsCode('000001')).toBe('000001.SZ');
    });

    it('MD-014: toTsCode 北京', () => {
      expect((MarketDataService as any).toTsCode('830000')).toBe('830000.BJ');
    });

    it('MD-015: fromTsCode', () => {
      expect((MarketDataService as any).fromTsCode('000001.SZ')).toBe('000001');
    });

    it('MD-016: exchangeFromSymbol', () => {
      expect((MarketDataService as any).exchangeFromSymbol('600519')).toBe('SH');
      expect((MarketDataService as any).exchangeFromSymbol('000001')).toBe('SZ');
      expect((MarketDataService as any).exchangeFromSymbol('830000')).toBe('BJ');
      expect((MarketDataService as any).exchangeFromSymbol('UNKNOWN')).toBe('SH');
    });
  });

  // ── syncFromTushare ──
  describe('syncFromTushare', () => {
    it('MD-017: 无 token 时应返回全失败', async () => {
      delete (process.env as any).TUSHARE_TOKEN;
      const result = await MarketDataService.syncFromTushare(['000001.SZ', '000002.SZ']);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(2);
    });

    it('MD-018: 成功同步数据', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          data: {
            fields: ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount'],
            items: [
              ['000001.SZ', '20260601', 10, 11, 9, 10, 1000, 10000],
            ],
          },
        },
      } as any);

      marketRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await MarketDataService.syncFromTushare(['000001.SZ']);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('MD-019: 无行情数据时应计为失败', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          data: {
            fields: ['ts_code', 'trade_date', 'close'],
            items: [],
          },
        },
      } as any);

      const result = await MarketDataService.syncFromTushare(['000001.SZ']);
      expect(result.failed).toBe(1);
    });
  });

  // ── getTrackedSymbols ──
  describe('getTrackedSymbols', () => {
    it('MD-020: 应返回去重后的 symbols', async () => {
      holdingRepo.find.mockResolvedValue([
        { symbol: '000001.SZ' },
        { symbol: '000002.SZ' },
        { symbol: '000001.SZ' },
      ]);
      const result = await MarketDataService.getTrackedSymbols();
      expect(result).toEqual(['000001.SZ', '000002.SZ']);
    });

    it('MD-021: 无持仓时应返回空数组', async () => {
      holdingRepo.find.mockResolvedValue([]);
      const result = await MarketDataService.getTrackedSymbols();
      expect(result).toEqual([]);
    });
  });

  // ── saveMarketData ──
  describe('saveMarketData', () => {
    it('MD-022: 应保存新数据', async () => {
      marketRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const data = [
        { symbol: '000001.SZ', trade_date: new Date('2026-06-01'), close_price: 12 },
      ];
      const result = await MarketDataService.saveMarketData(data);
      expect(result).toBe(1);
      expect(marketRepo.save).toHaveBeenCalled();
    });

    it('MD-023: 重复数据应跳过', async () => {
      marketRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { symbol: '000001.SZ', trade_date: '2026-06-01' },
        ]),
      });

      const data = [
        { symbol: '000001.SZ', trade_date: new Date('2026-06-01'), close_price: 12 },
      ];
      const result = await MarketDataService.saveMarketData(data);
      expect(result).toBe(0);
    });

    it('MD-024: 空数据应直接返回 0', async () => {
      const result = await MarketDataService.saveMarketData([]);
      expect(result).toBe(0);
    });
  });
});
