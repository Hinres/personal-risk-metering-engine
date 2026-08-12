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

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
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

const mockedGetRepository = AppDataSource.getRepository as jest.Mock;

describe('MarketDataService', () => {
  let marketRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    marketRepo = mockRepo();
    mockedGetRepository.mockImplementation((entity: any) => {
      const name = entity?.name || entity;
      if (name === 'MarketData' || name?.includes('Market')) return marketRepo;
      return mockRepo();
    });
    process.env.TUSHARE_TOKEN = 'test_token';
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.get.mockResolvedValue({ data: {} });
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
    });

    const result = await MarketDataService.getStockBasic();
    expect(mockedAxios.post).toHaveBeenCalled();
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('ts_code', '000001.SZ');
    expect(result[0]).toHaveProperty('name', '平安银行');
  });
});
