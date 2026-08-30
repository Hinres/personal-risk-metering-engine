/**
 * [PRME-INFRA-006] 基础设施
 * 文件: app.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-07-01
 */
// BUG-FIX: dotenv 必须在所有模块 import 之前加载，否则 jwt.ts 等 config 读取不到环境变量
import path from 'path';
if (process.env.NODE_ENV !== 'test') {
  const dotenv = require('dotenv');
  const fs = require('fs');
  const envFile = process.env.NODE_ENV
    ? `.env.${process.env.NODE_ENV}`
    : '.env';
  const envPath = path.resolve(__dirname, '..', envFile);
  const defaultEnvPath = path.resolve(__dirname, '../.env');
  // 按环境加载对应 .env 文件；不存在则回退到默认 .env
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config({ path: defaultEnvPath });
  }
}

import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import fs from 'fs';
import { AppDataSource, closeDatabase, initializeDatabase } from './config/database';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { Response } from 'express';
import { authMiddleware, AuthRequest } from './middleware/auth.middleware';
import { riskAcknowledgmentMiddleware } from './middleware/riskAcknowledgment.middleware';
import { initializeJobs, stopJobs } from './jobs';
import { closeBrowser } from './services/report.service';
import { Report } from './models/Report';
import WebSocketService from './services/websocket.service';
import routes from './routes';
import logger from './utils/logger';

// 环境变量加载日志（已移到顶部，此处仅记录）
if (process.env.NODE_ENV !== 'test') {
  logger.info('dotenv loaded from top-level');
  logger.info('WECHAT_APP_ID exists:', !!process.env.WECHAT_APP_ID);
  logger.info('WECHAT_APP_SECRET exists:', !!process.env.WECHAT_APP_SECRET);
}

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Security middleware
app.use(helmet());

// CORS: 生产环境禁止 '*'，必须配置具体域名
const corsOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin === '*')) {
  logger.error('FATAL: CORS_ORIGIN must be set to a specific domain in production, not "*"');
  process.exit(1);
}

app.use(cors({
  origin: corsOrigin || '*',
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Request logging
app.use(morgan('combined'));
app.use(requestLogger);

// Rate limiting
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
// PRME-UAT-20260721: 同时提供根路径和 API 前缀路径，兼容不同监控/负载均衡配置
const healthHandler = (req: any, res: any) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
};
app.get('/health', healthHandler);
app.get(`${API_PREFIX}/health`, healthHandler);

// API routes
app.use(API_PREFIX, routes);

// 静态文件服务：报告导出文件下载（需认证 + 授权）
app.get('/reports/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const fileName = req.params.filename;
    const reportId = fileName.split('_')[0];
    if (!reportId) {
      return res.status(404).json({ code: 404, message: 'Report not found', data: null });
    }

    const report = await AppDataSource.getRepository(Report).findOne({
      where: { report_id: reportId },
    });

    if (!report || report.user_id !== req.user?.user_id) {
      return res.status(403).json({ code: 403, message: 'Forbidden - Access denied', data: null });
    }

    const filePath = path.resolve(process.cwd(), 'uploads', 'reports', fileName);
    const reportsDir = path.resolve(process.cwd(), 'uploads', 'reports');
    if (!filePath.startsWith(reportsDir)) {
      return res.status(403).json({ code: 403, message: 'Forbidden - Invalid file path', data: null });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 404, message: 'File not found', data: null });
    }

    res.sendFile(filePath);
  } catch (error: any) {
    logger.error('Report download error', { error: error.message });
    return res.status(500).json({ code: 500, message: 'Download failed', data: null });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null,
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect database via initializeDatabase to ensure WAL mode and SQLite views
    await initializeDatabase();

    // 手动执行待运行迁移（initializeDatabase 已运行同步/初始化，但显式 runMigrations 可确保新迁移应用）
    if (process.env.NODE_ENV !== 'test') {
      try {
        const pendingMigrations = await AppDataSource.showMigrations();
        if (pendingMigrations) {
          logger.info('Running pending migrations...');
          await AppDataSource.runMigrations();
          logger.info('Migrations completed successfully');
        } else {
          logger.info('No pending migrations');
        }
      } catch (migrationErr) {
        logger.error('Migration execution error:', migrationErr);
      }

      // 设置 SQLite 文件权限为 660（安全合规：所有者+同组可读写）
      // 说明：后端可能以非文件所有者（qa:openclaw）运行，因此需要同组可读写的权限。
      // 生产环境建议：启动前由 DevOps 将数据库文件所有者/组设置为运行用户（chown qa:openclaw）。
      try {
        const fs = require('fs');
        const path = require('path');
        const dbFile = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data/database.sqlite');
        const files = [
          dbFile,
          `${dbFile}-wal`,
          `${dbFile}-shm`,
        ];
        for (const f of files) {
          if (fs.existsSync(f)) {
            // 1) 放宽为 660，确保运行用户所在组（openclaw）可访问
            fs.chmodSync(f, 0o660);
            // 2) 如果当前进程是文件所有者/ root，尝试将组改为当前进程的有效组（通常是 openclaw）
            try {
              const stat = fs.statSync(f);
              const gid = process.getgid ? process.getgid() : stat.gid;
              if (stat.uid === process.getuid?.() || process.getuid?.() === 0) {
                fs.chownSync(f, stat.uid, gid);
              }
            } catch (chownErr: any) {
              logger.warn('SQLite chown skipped', { file: f, error: chownErr.message });
            }
          }
        }
        logger.info('SQLite file permissions set to 660');
      } catch (permErr) {
        logger.error('Failed to set SQLite file permissions:', permErr);
      }
    }

    // Initialize cron jobs
    const scheduledTasks = initializeJobs();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`WebSocket: ws://localhost:${PORT}/ws`);
    });

    // Initialize WebSocket server
    const wsService = WebSocketService.getInstance();
    wsService.initialize(server);

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Stop cron jobs first to prevent new tasks during shutdown
      stopJobs();
      logger.info('Cron jobs stopped');
      
      // Close WebSocket server
      try {
        wsService.close();
      } catch (err) {
        logger.error('Error closing WebSocket server:', err);
      }
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await closeDatabase();
          logger.info('Database connection closed');
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (err) {
          logger.error('Error during graceful shutdown:', err);
          process.exit(1);
        }
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after 30 seconds timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Start server (skip in test environment to avoid port conflicts)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
