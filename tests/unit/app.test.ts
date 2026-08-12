/**
 * [PRME-INFRA-006] app.ts 单元测试
 * 测试范围: health check, 报告下载路由, 404 handler, CORS/安全中间件
 * 最后更新: 2026-06-30
 */
import request from 'supertest';

// Mock modules BEFORE importing app
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { user_id: 'u1', username: 'test', role: 'admin' };
    next();
  },
  adminMiddleware: (req: any, res: any, next: any) => next(),
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
  },
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
      pushAlert: jest.fn(),
    }),
  },
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

jest.mock('../../src/services/report.service', () => ({
  closeBrowser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs');

// Import app AFTER mocks are set up
const app = require('../../src/app').default;
const { AppDataSource } = require('../../src/config/database');
const fs = require('fs');

describe('app.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('environment');
    });
  });

  describe('GET /reports/:filename', () => {
    const mockReportRepo = {
      findOne: jest.fn(),
    };

    beforeEach(() => {
      AppDataSource.getRepository.mockReturnValue(mockReportRepo);
    });

    it('should return 404 when reportId cannot be extracted from filename', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/reports/_report.pdf')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Report not found');
    });

    it('should return 403 when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/reports/r123_report.pdf')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should return 403 when report owned by different user', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        report_id: 'r123',
        user_id: 'other-user',
      });

      const res = await request(app)
        .get('/reports/r123_report.pdf')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('should return 404 when file does not exist', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        report_id: 'r123',
        user_id: 'u1',
      });
      fs.existsSync.mockReturnValue(false);

      const res = await request(app)
        .get('/reports/r123_report.pdf')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('File not found');
    });

    it('should return 500 on database error', async () => {
      mockReportRepo.findOne.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/reports/r123_report.pdf')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Download failed');
    });
  });

  describe('API_PREFIX', () => {
    it('should use custom API prefix when set', async () => {
      jest.resetModules();
      const originalPrefix = process.env.API_PREFIX;
      process.env.API_PREFIX = '/api/v2';
      const freshApp = require('../../src/app').default;

      // Any unmatched route should hit 404 handler
      const res = await request(freshApp).get('/api/v2/nonexistent-route-test');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('接口不存在');

      process.env.API_PREFIX = originalPrefix;
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route-xyz');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe(404);
      expect(res.body.message).toBe('接口不存在');
    });
  });

  describe('CORS middleware', () => {
    it('should allow CORS preflight requests', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(204);
    });
  });
});
