/**
 * [PRME-v1.3-TS-003] 视频教程
 * 文件: videoTutorial.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import { VideoTutorialService } from '../services/videoTutorial.service';
import { successResponse, errorResponse } from '../utils/response';

export const getVideos = async (req: any, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const topic = req.query.topic as string | undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await VideoTutorialService.getVideos(category, topic, page, pageSize);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getVideoById = async (req: any, res: Response) => {
  try {
    const result = await VideoTutorialService.getVideoById(req.params.id);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};
