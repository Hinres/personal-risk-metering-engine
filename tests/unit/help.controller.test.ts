/**
 * [PRME-TS-003] help.controller 单元测试
 * 测试范围: getHelpList, getHelpByTopic, searchHelp, createHelp, updateHelp, deleteHelp
 * 最后更新: 2026-06-24
 */
import * as helpController from '../../src/controllers/help.controller';
import { HelpContentService } from '../../src/services/helpContent.service';
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

jest.mock('../../src/services/helpContent.service');
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
  get: jest.fn().mockReturnValue('test-agent'),
});

const mockRes = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('help.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHelpList', () => {
    it('should get paginated help list', async () => {
      const req = mockReq({}, {}, { page: '1', limit: '20', category: 'general' });
      const res = mockRes();

      (HelpContentService.getList as jest.Mock).mockResolvedValue({
        items: [{ id: 'h1', title: 'Test' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await helpController.getHelpList(req as any, res);
      expect(paginatedResponse).toHaveBeenCalled();
    });

    it('should use default page and limit when not provided', async () => {
      const req = mockReq({}, {}, { category: 'general' });
      const res = mockRes();

      (HelpContentService.getList as jest.Mock).mockResolvedValue({
        items: [{ id: 'h1', title: 'Test' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await helpController.getHelpList(req as any, res);
      expect(paginatedResponse).toHaveBeenCalled();
      expect(HelpContentService.getList).toHaveBeenCalledWith('general', 1, 20);
    });

    it('should handle errors', async () => {
      const req = mockReq();
      const res = mockRes();

      (HelpContentService.getList as jest.Mock).mockRejectedValue(new Error('DB error'));

      await helpController.getHelpList(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'DB error', 500);
    });
  });

  describe('getHelpByTopic', () => {
    it('should get help by topic', async () => {
      const req = mockReq({}, { topic: 'risk' });
      const res = mockRes();

      (HelpContentService.getByTopic as jest.Mock).mockResolvedValue({ topic: 'risk', content: '...' });

      await helpController.getHelpByTopic(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { topic: 'risk', content: '...' });
    });

    it('should return 404 for missing topic', async () => {
      const req = mockReq({}, { topic: 'missing' });
      const res = mockRes();

      (HelpContentService.getByTopic as jest.Mock).mockRejectedValue(new Error('Not found'));

      await helpController.getHelpByTopic(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Not found', 404);
    });
  });

  describe('searchHelp', () => {
    it('should search help', async () => {
      const req = mockReq({}, {}, { q: 'var', page: '1', limit: '20' });
      const res = mockRes();

      (HelpContentService.search as jest.Mock).mockResolvedValue({
        items: [{ id: 'h1' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await helpController.searchHelp(req as any, res);
      expect(paginatedResponse).toHaveBeenCalled();
    });

    it('should search with default page and limit', async () => {
      const req = mockReq({}, {}, { q: 'var' });
      const res = mockRes();

      (HelpContentService.search as jest.Mock).mockResolvedValue({
        items: [{ id: 'h1' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      await helpController.searchHelp(req as any, res);
      expect(paginatedResponse).toHaveBeenCalled();
      expect(HelpContentService.search).toHaveBeenCalledWith('var', 1, 20);
    });

    it('should handle search errors', async () => {
      const req = mockReq({}, {}, { q: 'var' });
      const res = mockRes();

      (HelpContentService.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      await helpController.searchHelp(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Search failed', 500);
    });

    it('should reject missing query', async () => {
      const req = mockReq({}, {}, {});
      const res = mockRes();

      await helpController.searchHelp(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Search query (q) is required', 400);
    });
  });

  describe('createHelp', () => {
    it('should create help', async () => {
      const req = mockReq({ title: 'New', content: '...' });
      const res = mockRes();

      (HelpContentService.create as jest.Mock).mockResolvedValue({ id: 'h1' });

      await helpController.createHelp(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { id: 'h1' }, 'Help content created', 201);
    });

    it('should handle creation error', async () => {
      const req = mockReq({});
      const res = mockRes();

      (HelpContentService.create as jest.Mock).mockRejectedValue(new Error('Invalid'));

      await helpController.createHelp(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Invalid', 400);
    });
  });

  describe('updateHelp', () => {
    it('should update help', async () => {
      const req = mockReq({ title: 'Updated' }, { id: 'h1' });
      const res = mockRes();

      (HelpContentService.update as jest.Mock).mockResolvedValue({ id: 'h1', title: 'Updated' });

      await helpController.updateHelp(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, { id: 'h1', title: 'Updated' }, 'Help content updated');
    });

    it('should return 404 if not found', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();

      (HelpContentService.update as jest.Mock).mockRejectedValue(new Error('Not found'));

      await helpController.updateHelp(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Not found', 404);
    });
  });

  describe('deleteHelp', () => {
    it('should delete help', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();

      (HelpContentService.delete as jest.Mock).mockResolvedValue(undefined);

      await helpController.deleteHelp(req as any, res);
      expect(successResponse).toHaveBeenCalledWith(res, null, 'Help content deleted');
    });

    it('should return 404 if not found', async () => {
      const req = mockReq({}, { id: 'h1' });
      const res = mockRes();

      (HelpContentService.delete as jest.Mock).mockRejectedValue(new Error('Not found'));

      await helpController.deleteHelp(req as any, res);
      expect(errorResponse).toHaveBeenCalledWith(res, 'Not found', 404);
    });
  });
});
