/**
 * [PRME-v1.3-PA-002] 完整 Brinson 业绩归因
 * 文件: attribution.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { AttributionService, BrinsonBenchmark } from '../services/attribution.service';
import { successResponse, errorResponse } from '../utils/response';

export const runAttribution = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { benchmark_type = 'equal_weight', benchmark, include_interaction = true } = req.body;

    let benchmarkConfig: BrinsonBenchmark | null = null;
    if (benchmark_type === 'custom' && benchmark) {
      benchmarkConfig = {
        sectors: benchmark.sectors || {},
        returns: benchmark.returns || {},
      };
    }

    const result = await AttributionService.calculateAndSave(id, userId, benchmark_type, benchmarkConfig);
    return successResponse(res, {
      ...result,
      sector_details: result.sector_details,
      disclaimer: '本归因结果仅供参考，不构成投资建议。',
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getAttributionHistory = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await AttributionService.getHistory(id, userId, page, pageSize);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
