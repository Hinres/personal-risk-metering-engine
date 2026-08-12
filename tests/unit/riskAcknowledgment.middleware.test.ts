/**
 * [PRME-INFRA-001] 风险提示中间件单元测试
 * 测试范围: riskAcknowledgmentMiddleware, optimizationConsentMiddleware
 * 最后更新: 2026-06-20
 */
import { riskAcknowledgmentMiddleware, optimizationConsentMiddleware } from '../../src/middleware/riskAcknowledgment.middleware';
import { errorResponse } from '../../src/utils/response';
import { AppDataSource } from '../../src/config/database';

jest.mock('../../src/utils/response');
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('riskAcknowledgmentMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow whitelist paths', async () => {
    const req: any = { path: '/api/v1/auth/login', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow health endpoint', async () => {
    const req: any = { path: '/api/v1/health', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow requests without user', async () => {
    const req: any = { path: '/api/v1/portfolios' };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject unacknowledged users', async () => {
    const mockRepo = { findOne: jest.fn().mockResolvedValue({ user_id: 'u1', first_risk_acknowledged: false }) };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    const req: any = { path: '/api/v1/portfolios', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, '首次风险提示未确认', 403, expect.stringContaining('RISK_ACK_REQUIRED'));
  });

  it('should reject missing user record', async () => {
    const mockRepo = { findOne: jest.fn().mockResolvedValue(null) };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    const req: any = { path: '/api/v1/portfolios', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, '首次风险提示未确认', 403, expect.any(String));
  });

  it('should allow acknowledged users', async () => {
    const mockRepo = { findOne: jest.fn().mockResolvedValue({ user_id: 'u1', first_risk_acknowledged: true }) };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    const req: any = { path: '/api/v1/portfolios', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const mockRepo = { findOne: jest.fn().mockRejectedValue(new Error('DB error')) };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    const req: any = { path: '/api/v1/portfolios', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await riskAcknowledgmentMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, '风险提示检查失败', 500);
  });
});

describe('optimizationConsentMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests without user', async () => {
    const req: any = { path: '/api/v1/optimization' };
    const res = mockResponse();
    const next = jest.fn();
    await optimizationConsentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject users without consent', async () => {
    jest.mock('../../src/services/consent.service', () => ({
      ConsentService: { checkConsent: jest.fn().mockResolvedValue(false) },
    }));
    const { ConsentService } = await import('../../src/services/consent.service');
    (ConsentService.checkConsent as jest.Mock).mockResolvedValue(false);
    const req: any = { path: '/api/v1/optimization', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await optimizationConsentMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(res, '未授权优化建议功能', 403, expect.stringContaining('CONSENT_REQUIRED'));
  });

  it('should allow users with consent', async () => {
    const { ConsentService } = await import('../../src/services/consent.service');
    (ConsentService.checkConsent as jest.Mock).mockResolvedValue(true);
    const req: any = { path: '/api/v1/optimization', user: { user_id: 'u1' } };
    const res = mockResponse();
    const next = jest.fn();
    await optimizationConsentMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});