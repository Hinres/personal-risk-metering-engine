/**
 * [PRME-v1.3-PA-004] 持仓批量导入
 * 文件: holdingImport.controller.ts
 * 最后更新: 2026-08-20
 */
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HoldingImportService } from '../services/holdingImport.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const uploadDir = path.resolve(process.cwd(), 'uploads', 'imports');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e: any) {
  logger.warn('Failed to create upload directory', { error: e.message, uploadDir });
}

const ensureUploadDir = () => {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (e: any) {
    logger.warn('Failed to ensure upload directory', { error: e.message });
  }
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureUploadDir()),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .xlsx 或 .csv 文件'));
    }
  },
}).single('file');

export const importHoldings = (req: any, res: Response) => {
  upload(req, res, async (err: any) => {
    if (err) {
      return errorResponse(res, err.message, 400);
    }
    try {
      if (!req.file) {
        return errorResponse(res, '请上传文件', 400);
      }
      const { portfolio_id } = req.params;
      const userId = req.user.user_id;
      const result = await HoldingImportService.importFromFile(portfolio_id, userId, req.file);
      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  });
};

export const getImportTask = async (req: any, res: Response) => {
  try {
    const userId = req.user.user_id;
    const result = await HoldingImportService.getTaskById(req.params.task_id, userId);
    return successResponse(res, result);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};
