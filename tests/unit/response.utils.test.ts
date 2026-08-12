/**
 * [PRME-INFRA-006] 基础设施 - response utils 单元测试
 * 测试范围: successResponse, errorResponse, paginatedResponse
 * 最后更新: 2026-06-20
 */
import { successResponse, errorResponse, paginatedResponse } from '../../src/utils/response';

const mockResponse = () => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return res;
};

describe('successResponse', () => {
  it('should return 200 with data', () => {
    const res = mockResponse();
    successResponse(res, { id: 1 }, 'OK');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: 1 }, message: 'OK' }));
  });

  it('should return custom status', () => {
    const res = mockResponse();
    successResponse(res, { id: 1 }, 'Created', 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should handle null data', () => {
    const res = mockResponse();
    successResponse(res, null, 'Done');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: null, message: 'Done' }));
  });

  it('should default message to "Success"', () => {
    const res = mockResponse();
    successResponse(res, { id: 1 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Success' }));
  });
});

describe('errorResponse', () => {
  it('should return 400 with error message', () => {
    const res = mockResponse();
    errorResponse(res, 'Bad request', 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Bad request' }));
  });

  it('should default to 400', () => {
    const res = mockResponse();
    errorResponse(res, 'Error');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('paginatedResponse', () => {
  it('should return paginated data with meta', () => {
    const res = mockResponse();
    paginatedResponse(res, [{ id: 1 }], 10, 2, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: [{ id: 1 }],
      meta: { total: 10, page: 2, limit: 5, totalPages: 2 }
    }));
  });

  it('should calculate totalPages correctly', () => {
    const res = mockResponse();
    paginatedResponse(res, [], 11, 1, 5);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({ totalPages: 3 })
    }));
  });

  it('should handle zero total', () => {
    const res = mockResponse();
    paginatedResponse(res, [], 0, 1, 10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({ totalPages: 0 })
    }));
  });
});
