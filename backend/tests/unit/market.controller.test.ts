/**
 * [PRME-RM-002] market.controller 单元测试
 * 测试范围: acknowledgeMarketRiskAlert, getMarketRiskAlerts
 * 最后更新: 2026-06-24
 */
import * as marketController from '../../src/controllers/market.controller';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse } from '../../src/utils/response';
import { In } from 'typeorm';

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('typeorm', () => ({
  In: jest.fn((ids) => ids),
  Entity: jest.fn(() => () => {}),
  PrimaryGeneratedColumn: jest.fn(() => () => {}),
  PrimaryColumn: jest.fn(() => () => {}),
  Column: jest.fn(() => () => {}),
  CreateDateColumn: jest.fn(() => () => {}),
  UpdateDateColumn: jest.fn(() => () => {}),
  DeleteDateColumn: jest.fn(() => () => {}),
  Index: jest.fn(() => () => {}),
  ManyToOne: jest.fn(() => () => {}),
  JoinColumn: jest.fn(() => () => {}),
  OneToMany: jest.fn(() => () => {}),
  Check: jest.fn(() => () => {}),
}));
jest.mock('../../src/utils/dbTypes', () => ({
  DateTimeColumn: jest.fn(() => () => {}),
  JsonColumn: jest.fn(() => () => {}),
  getDbType: jest.fn().mockReturnValue('sqlite'),
  setDbType: jest.fn(),
  getJsonType: jest.fn().mockReturnValue('simple-json'),
  getDateTimeType: jest.fn().mockReturnValue('datetime'),
  getJsonbIndexSql: jest.fn().mockReturnValue(''),
}));

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-agent'),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('market.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource.getRepository as jest.Mock).mockReset();
  });

  describe('acknowledgeMarketRiskAlert', () => {
    it('should acknowledge alert successfully', async () => {
      const req = mockReq({}, { id: 'a1' }, {}, { user_id: 'u1' });
      const res = mockRes();

      const alert = { alert_id: 'a1', acknowledged_count: 0 };
      const createdAck = { alert_id: 'a1', user_id: 'u1', acknowledged_at: new Date() };

      let callCount = 0;
      (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 4) {
          return {
            findOne: jest.fn().mockResolvedValue(alert),
            save: jest.fn().mockResolvedValue({ ...alert, acknowledged_count: 1 }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue(createdAck),
          save: jest.fn().mockResolvedValue(createdAck),
        };
      });

      await marketController.acknowledgeMarketRiskAlert(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ acknowledged: true }),
        'Acknowledged'
      );
    });

    it('should return already acknowledged when already exists', async () => {
      const req = mockReq({}, { id: 'a1' }, {}, { user_id: 'u1' });
      const res = mockRes();

      const alert = { alert_id: 'a1', acknowledged_count: 1 };
      const existingAck = { alert_id: 'a1', user_id: 'u1', acknowledged_at: new Date('2026-06-01') };

      let callCount = 0;
      (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 3) {
          return {
            findOne: jest.fn().mockResolvedValue(alert),
            save: jest.fn(),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(existingAck),
          create: jest.fn(),
          save: jest.fn(),
        };
      });

      await marketController.acknowledgeMarketRiskAlert(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ acknowledged: true, acknowledged_at: existingAck.acknowledged_at }),
        'Already acknowledged'
      );
    });

    it('should return 404 when alert not found', async () => {
      const req = mockReq({}, { id: 'a1' }, {}, { user_id: 'u1' });
      const res = mockRes();

      const alertRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(alertRepo);

      await marketController.acknowledgeMarketRiskAlert(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Market risk alert not found', 404);
    });

    it('should return 401 when user not authenticated', async () => {
      const req = mockReq({}, { id: 'a1' }, {}, null);
      const res = mockRes();

      await marketController.acknowledgeMarketRiskAlert(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized', 401);
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockReq({}, { id: 'a1' }, {}, { user_id: 'u1' });
      const res = mockRes();

      (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
        throw new Error('db error');
      });

      await marketController.acknowledgeMarketRiskAlert(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to acknowledge alert', 500);
    });
  });

  describe('getMarketRiskAlerts', () => {
    it('should return paginated alerts with acknowledgment status', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '20' }, { user_id: 'u1' });
      const res = mockRes();

      const alerts = [
        { alert_id: 'a1', index_symbol: 'CSI300', title: 'Alert 1' },
        { alert_id: 'a2', index_symbol: 'CSI500', title: 'Alert 2' },
      ];
      const alertRepo = { findAndCount: jest.fn().mockResolvedValue([alerts, 2]) };
      const acks = [{ alert_id: 'a1' }];
      const ackRepo = { find: jest.fn().mockResolvedValue(acks) };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(alertRepo)
        .mockReturnValueOnce(ackRepo);

      await marketController.getMarketRiskAlerts(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          alerts: expect.arrayContaining([
            expect.objectContaining({ alert_id: 'a1', is_acknowledged_by_user: true }),
            expect.objectContaining({ alert_id: 'a2', is_acknowledged_by_user: false }),
          ]),
          total: 2,
          page: 1,
          limit: 20,
        })
      );
    });

    it('should use default pagination and return empty alerts', async () => {
      const req = mockReq({}, {}, {}, { user_id: 'u1' });
      const res = mockRes();

      const alertRepo = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const ackRepo = { find: jest.fn().mockResolvedValue([]) };

      (AppDataSource.getRepository as jest.Mock)
        .mockReturnValueOnce(alertRepo)
        .mockReturnValueOnce(ackRepo);

      await marketController.getMarketRiskAlerts(req as any, res);
      expect(ackRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ alerts: [], total: 0, page: 1, limit: 20 }));
    });

    it('should return 401 when user not authenticated', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '20' }, null);
      const res = mockRes();

      await marketController.getMarketRiskAlerts(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Unauthorized', 401);
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '20' }, { user_id: 'u1' });
      const res = mockRes();

      (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
        throw new Error('db error');
      });

      await marketController.getMarketRiskAlerts(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Failed to fetch alerts', 500);
    });
  });
});
