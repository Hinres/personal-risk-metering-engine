/**
 * [PRME-TS-002] user.controller 单元测试
 * 测试范围: getProfile, updateProfile, updateWechatInfo, getPreferences, updatePreferences, getUsers, deleteUser, riskAcknowledgment, getRiskAcknowledgmentStatus, recordConsent, revokeConsent, getConsents, requestDataExport, getExportStatus, getExportList, downloadExport
 * 最后更新: 2026-06-20
 */
import * as userController from '../../src/controllers/user.controller';
import { UserService } from '../../src/services/user.service';
import { AuthService } from '../../src/services/auth.service';
import { ConsentService } from '../../src/services/consent.service';
import { DataExportService } from '../../src/services/dataExport.service';
import { AppDataSource } from '../../src/config/database';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

jest.mock('../../src/services/user.service');
jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/consent.service');
jest.mock('../../src/services/dataExport.service');
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

const mockReq = (body: any = {}, params: any = {}, query: any = {}, user: any = { user_id: 'u1' }) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis(), sendFile: jest.fn().mockReturnThis() };
  return res;
};

describe('user.controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getProfile', () => {
    it('should get profile', async () => {
      const req = mockReq();
      const res = mockRes();
      (UserService.getProfile as jest.Mock).mockResolvedValue({ user_id: 'u1' });
      await userController.getProfile(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { user_id: 'u1' });
    });

    it('should handle errors', async () => {
      const req = mockReq();
      const res = mockRes();
      (UserService.getProfile as jest.Mock).mockRejectedValue(new Error('not found'));
      await userController.getProfile(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('updateProfile', () => {
    it('should update profile', async () => {
      const req = mockReq({ name: 'Test' });
      const res = mockRes();
      (UserService.updateProfile as jest.Mock).mockResolvedValue({ user_id: 'u1', name: 'Test' });
      await userController.updateProfile(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { user_id: 'u1', name: 'Test' }, 'Profile updated');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({ name: 'Test' });
      const res = mockRes();
      (UserService.updateProfile as jest.Mock).mockRejectedValue(new Error('invalid input'));
      await userController.updateProfile(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'invalid input', 400);
    });
  });

  describe('updateWechatInfo', () => {
    it('should update wechat info', async () => {
      const req = mockReq({ openid: 'wx123' });
      const res = mockRes();
      (AuthService.updateWechatUser as jest.Mock).mockResolvedValue({ user_id: 'u1' });
      await userController.updateWechatInfo(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { user_id: 'u1' }, 'WeChat info updated');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({ openid: 'wx123' });
      const res = mockRes();
      (AuthService.updateWechatUser as jest.Mock).mockRejectedValue(new Error('wechat error'));
      await userController.updateWechatInfo(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'wechat error', 400);
    });
  });

  describe('getPreferences', () => {
    it('should get preferences', async () => {
      const req = mockReq();
      const res = mockRes();
      (UserService.getPreferences as jest.Mock).mockResolvedValue({ theme: 'dark' });
      await userController.getPreferences(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { theme: 'dark' });
    });

    it('should handle error (500)', async () => {
      const req = mockReq();
      const res = mockRes();
      (UserService.getPreferences as jest.Mock).mockRejectedValue(new Error('db error'));
      await userController.getPreferences(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db error', 500);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      const req = mockReq({ theme: 'light' });
      const res = mockRes();
      (UserService.updatePreferences as jest.Mock).mockResolvedValue({ theme: 'light' });
      await userController.updatePreferences(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { theme: 'light' }, 'Preferences updated');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({ theme: 'light' });
      const res = mockRes();
      (UserService.updatePreferences as jest.Mock).mockRejectedValue(new Error('invalid prefs'));
      await userController.updatePreferences(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'invalid prefs', 400);
    });
  });

  describe('getUsers', () => {
    it('should get users with default pagination', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (UserService.getUsers as jest.Mock).mockResolvedValue({ users: [], total: 0, page: 1, limit: 10 });
      await userController.getUsers(req as any, res);
      expect(UserService.getUsers).toHaveBeenCalledWith(1, 10, { status: undefined, search: undefined });
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should get users', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (UserService.getUsers as jest.Mock).mockResolvedValue({ users: [], total: 0, page: 1, limit: 10 });
      await userController.getUsers(req as any, res);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should handle error (500)', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (UserService.getUsers as jest.Mock).mockRejectedValue(new Error('db error'));
      await userController.getUsers(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db error', 500);
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const req = mockReq({}, { id: 'u1' });
      const res = mockRes();
      (UserService.deleteUser as jest.Mock).mockResolvedValue(undefined);
      await userController.deleteUser(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'User deleted');
    });

    it('should handle error (404)', async () => {
      const req = mockReq({}, { id: 'u1' });
      const res = mockRes();
      (UserService.deleteUser as jest.Mock).mockRejectedValue(new Error('not found'));
      await userController.deleteUser(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('riskAcknowledgment', () => {
    it('should confirm risk acknowledgment', async () => {
      const req = mockReq();
      const res = mockRes();
      const userRepo = { findOne: jest.fn().mockResolvedValue({ user_id: 'u1', first_risk_acknowledged: false }), save: jest.fn().mockResolvedValue({}) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(userRepo);
      await userController.riskAcknowledgment(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ first_risk_acknowledged: true }), 'Risk acknowledgment confirmed');
    });

    it('should handle user not found', async () => {
      const req = mockReq();
      const res = mockRes();
      const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(userRepo);
      await userController.riskAcknowledgment(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'User not found', 400);
    });
  });

  describe('getRiskAcknowledgmentStatus', () => {
    it('should get status', async () => {
      const req = mockReq();
      const res = mockRes();
      const userRepo = { findOne: jest.fn().mockResolvedValue({ user_id: 'u1', first_risk_acknowledged: true, first_risk_acknowledged_at: new Date() }) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(userRepo);
      await userController.getRiskAcknowledgmentStatus(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, expect.objectContaining({ first_risk_acknowledged: true }));
    });

    it('should handle user not found (404)', async () => {
      const req = mockReq();
      const res = mockRes();
      const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(userRepo);
      await userController.getRiskAcknowledgmentStatus(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'User not found', 400);
    });
  });

  describe('recordConsent', () => {
    it('should record consent', async () => {
      const req = mockReq({ consent_type: 'marketing', granted_via: 'api' });
      const res = mockRes();
      (ConsentService.recordConsent as jest.Mock).mockResolvedValue({ consent_id: 'c1' });
      await userController.recordConsent(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { consent_id: 'c1' }, 'Consent recorded');
    });

    it('should use default granted_via=api when not provided', async () => {
      const req = mockReq({ consent_type: 'marketing' });
      const res = mockRes();
      (ConsentService.recordConsent as jest.Mock).mockResolvedValue({ consent_id: 'c1' });
      await userController.recordConsent(req as any, res);
      expect(ConsentService.recordConsent).toHaveBeenCalledWith('u1', 'marketing', 'api', '127.0.0.1');
      expect(successResponse).toHaveBeenCalledWith(res, { consent_id: 'c1' }, 'Consent recorded');
    });

    it('should use default req.ip when not provided', async () => {
      const req = { body: { consent_type: 'marketing' }, params: {}, query: {}, user: { user_id: 'u1' } };
      const res = mockRes();
      (ConsentService.recordConsent as jest.Mock).mockResolvedValue({ consent_id: 'c1' });
      await userController.recordConsent(req as any, res);
      expect(ConsentService.recordConsent).toHaveBeenCalledWith('u1', 'marketing', 'api', undefined);
      expect(successResponse).toHaveBeenCalledWith(res, { consent_id: 'c1' }, 'Consent recorded');
    });

    it('should handle error in recordConsent catch', async () => {
      const req = mockReq({ consent_type: 'marketing' });
      const res = mockRes();
      (ConsentService.recordConsent as jest.Mock).mockRejectedValue(new Error('consent error'));
      await userController.recordConsent(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'consent error', 400);
    });

    it('should reject missing consent_type', async () => {
      const req = mockReq({});
      const res = mockRes();
      await userController.recordConsent(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'consent_type is required', 400);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent', async () => {
      const req = mockReq({ reason: 'no longer needed' }, { consent_type: 'marketing' });
      const res = mockRes();
      (ConsentService.revokeConsent as jest.Mock).mockResolvedValue({ consent_id: 'c1', status: 'revoked' });
      await userController.revokeConsent(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { consent_id: 'c1', status: 'revoked' }, 'Consent revoked');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({ reason: 'no longer needed' }, { consent_type: 'marketing' });
      const res = mockRes();
      (ConsentService.revokeConsent as jest.Mock).mockRejectedValue(new Error('revoke failed'));
      await userController.revokeConsent(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'revoke failed', 400);
    });
  });

  describe('getConsents', () => {
    it('should get consents', async () => {
      const req = mockReq();
      const res = mockRes();
      (ConsentService.getConsents as jest.Mock).mockResolvedValue([{ consent_id: 'c1' }]);
      await userController.getConsents(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, [{ consent_id: 'c1' }]);
    });

    it('should handle error (500)', async () => {
      const req = mockReq();
      const res = mockRes();
      (ConsentService.getConsents as jest.Mock).mockRejectedValue(new Error('db error'));
      await userController.getConsents(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db error', 500);
    });
  });

  describe('requestDataExport', () => {
    it('should request export', async () => {
      const req = mockReq({ format: 'json', include_tables: ['users'] });
      const res = mockRes();
      (DataExportService.requestExport as jest.Mock).mockResolvedValue({ export_id: 'e1' });
      await userController.requestDataExport(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { export_id: 'e1' }, 'Export request submitted');
    });

    it('should use default format=json when not provided', async () => {
      const req = mockReq({ include_tables: ['users'] });
      const res = mockRes();
      (DataExportService.requestExport as jest.Mock).mockResolvedValue({ export_id: 'e1' });
      await userController.requestDataExport(req as any, res);
      expect(DataExportService.requestExport).toHaveBeenCalledWith('u1', 'json', ['users']);
      expect(successResponse).toHaveBeenCalledWith(res, { export_id: 'e1' }, 'Export request submitted');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({ format: 'json', include_tables: ['users'] });
      const res = mockRes();
      (DataExportService.requestExport as jest.Mock).mockRejectedValue(new Error('invalid request'));
      await userController.requestDataExport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'invalid request', 400);
    });
  });

  describe('getExportStatus', () => {
    it('should get export status', async () => {
      const req = mockReq({}, { export_id: 'e1' });
      const res = mockRes();
      (DataExportService.getExportStatus as jest.Mock).mockResolvedValue({ status: 'completed' });
      await userController.getExportStatus(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { status: 'completed' });
    });

    it('should handle error (404)', async () => {
      const req = mockReq({}, { export_id: 'e1' });
      const res = mockRes();
      (DataExportService.getExportStatus as jest.Mock).mockRejectedValue(new Error('not found'));
      await userController.getExportStatus(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'not found', 404);
    });
  });

  describe('getExportList', () => {
    it('should get export list with default pagination', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();
      (DataExportService.getExportList as jest.Mock).mockResolvedValue({ exports: [], total: 0, page: 1, limit: 10 });
      await userController.getExportList(req as any, res);
      expect(DataExportService.getExportList).toHaveBeenCalledWith('u1', 1, 10);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should get export list', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (DataExportService.getExportList as jest.Mock).mockResolvedValue({ exports: [], total: 0, page: 1, limit: 10 });
      await userController.getExportList(req as any, res);
      expect(paginatedResponse).toHaveBeenCalledWith(res, [], 0, 1, 10);
    });

    it('should handle error (500)', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '10' });
      const res = mockRes();
      (DataExportService.getExportList as jest.Mock).mockRejectedValue(new Error('db error'));
      await userController.getExportList(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'db error', 500);
    });
  });

  describe('downloadExport', () => {
    it('should download export', async () => {
      const req = mockReq({}, { export_id: 'e1' });
      const res = mockRes();
      (DataExportService.downloadExport as jest.Mock).mockResolvedValue({ filePath: '/tmp/test.json', fileName: 'test.json' });
      await userController.downloadExport(req as any, res);
      expect(res.sendFile).toHaveBeenCalledWith('/tmp/test.json');
    });

    it('should handle error (400)', async () => {
      const req = mockReq({}, { export_id: 'e1' });
      const res = mockRes();
      (DataExportService.downloadExport as jest.Mock).mockRejectedValue(new Error('download failed'));
      await userController.downloadExport(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'download failed', 400);
    });
  });
});
