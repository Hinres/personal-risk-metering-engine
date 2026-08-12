/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: dataExport.service.ts
 * 需求描述: 审计与合规功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { DataExportRequest } from '../models/DataExportRequest';
import { User } from '../models/User';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { VaRCalculation } from '../models/VaRCalculation';
import { StressTest } from '../models/StressTest';
import { AlertHistory } from '../models/AlertHistory';
import logger from '../utils/logger';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const exportRepo = () => AppDataSource.getRepository(DataExportRequest);

const EXPORT_TABLES = [
  'users', 'portfolios', 'holdings', 'var_calculations',
  'stress_tests', 'alert_records', 'risk_reports',
  'user_consents', 'data_export_requests'
];

export class DataExportService {
  static async requestExport(userId: string, format: string, includeTables?: string[]) {
    const tables = includeTables || EXPORT_TABLES;
    const invalid = tables.filter(t => !EXPORT_TABLES.includes(t));
    if (invalid.length > 0) {
      throw new Error(`Invalid include_tables: ${invalid.join(', ')}`);
    }

    const exportReq = exportRepo().create({
      user_id: userId,
      format: format === 'zip' ? 'zip' : 'json',
      include_tables: tables,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天有效期
    });

    await exportRepo().save(exportReq);

    // 异步生成导出文件
    this.generateExport(exportReq.export_id, userId, tables, format).catch(err => {
      logger.error('Export generation failed', { exportId: exportReq.export_id, error: err.message });
    });

    return {
      export_id: exportReq.export_id,
      status: 'generating',
      estimated_time: 60,
      expires_at: exportReq.expires_at,
    };
  }

  static async generateExport(exportId: string, userId: string, tables: string[], format: string) {
    const exportReq = await exportRepo().findOne({ where: { export_id: exportId } });
    if (!exportReq) return;

    try {
      exportReq.status = 'generating';
      await exportRepo().save(exportReq);

      const data: Record<string, any> = {};

      if (tables.includes('users')) {
        const user = await AppDataSource.getRepository(User).findOne({
          where: { user_id: userId },
          select: ['user_id', 'username', 'email', 'phone', 'avatar_url', 'status', 'role',
            'first_risk_acknowledged', 'created_at', 'updated_at', 'preferences', 'subscription'],
        });
        data.users = user ? [this.sanitizeUser(user)] : [];
      }

      if (tables.includes('portfolios')) {
        const portfolios = await AppDataSource.getRepository(Portfolio).find({
          where: { user_id: userId },
        });
        data.portfolios = portfolios;
      }

      if (tables.includes('holdings')) {
        const portfolioIds = (data.portfolios || []).map((p: any) => p.portfolio_id);
        if (portfolioIds.length > 0) {
          const holdings = await AppDataSource.getRepository(Holding)
            .createQueryBuilder('h')
            .where('h.portfolio_id IN (:...ids)', { ids: portfolioIds })
            .getMany();
          data.holdings = holdings;
        } else {
          data.holdings = [];
        }
      }

      if (tables.includes('var_calculations')) {
        const portfolioIds = (data.portfolios || []).map((p: any) => p.portfolio_id);
        if (portfolioIds.length > 0) {
          const varCalcs = await AppDataSource.getRepository(VaRCalculation)
            .createQueryBuilder('v')
            .where('v.portfolio_id IN (:...ids)', { ids: portfolioIds })
            .getMany();
          data.var_calculations = varCalcs;
        } else {
          data.var_calculations = [];
        }
      }

      if (tables.includes('stress_tests')) {
        const portfolioIds = (data.portfolios || []).map((p: any) => p.portfolio_id);
        if (portfolioIds.length > 0) {
          const stressTests = await AppDataSource.getRepository(StressTest)
            .createQueryBuilder('s')
            .where('s.portfolio_id IN (:...ids)', { ids: portfolioIds })
            .getMany();
          data.stress_tests = stressTests;
        } else {
          data.stress_tests = [];
        }
      }

      if (tables.includes('alert_records')) {
        const alerts = await AppDataSource.getRepository(AlertHistory)
          .createQueryBuilder('a')
          .where('a.user_id = :userId', { userId })
          .getMany();
        data.alert_history = alerts;
      }

      // 生成 manifest
      const manifest = this.generateManifest(data);
      data._manifest = manifest;

      // 写入文件
      const exportsDir = path.resolve(process.cwd(), 'uploads', 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const fileName = `${exportId}_export.json`;
      const filePath = path.join(exportsDir, fileName);
      const jsonContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonContent);

      const checksum = createHash('sha256').update(jsonContent).digest('hex');
      const fileSize = fs.statSync(filePath).size;

      exportReq.status = 'completed';
      exportReq.file_path = filePath;
      exportReq.file_size = fileSize;
      exportReq.checksum = checksum;
      exportReq.generated_at = new Date();
      await exportRepo().save(exportReq);

      logger.info('Export generated', { exportId, fileSize, checksum: checksum.substring(0, 16) });
    } catch (error: any) {
      exportReq.status = 'failed';
      exportReq.error_message = error.message;
      await exportRepo().save(exportReq);
      logger.error('Export generation failed', { exportId, error: error.message });
    }
  }

  private static sanitizeUser(user: any) {
    const { password_hash, phone_encrypted, wechat_info, metadata, ...rest } = user;
    return rest;
  }

  private static generateManifest(data: Record<string, any>) {
    const manifest: Record<string, any> = {
      generated_at: new Date().toISOString(),
      tables: {},
      total_records: 0,
      checksums: {},
    };

    for (const [key, value] of Object.entries(data)) {
      if (key === '_manifest') continue;
      const records = Array.isArray(value) ? value.length : 0;
      manifest.tables[key] = records;
      manifest.total_records += records;
      const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
      manifest.checksums[key] = hash.substring(0, 32);
    }

    return manifest;
  }

  static async getExportStatus(userId: string, exportId: string) {
    const exportReq = await exportRepo().findOne({
      where: { export_id: exportId, user_id: userId },
    });
    if (!exportReq) throw new Error('Export request not found');

    return {
      export_id: exportReq.export_id,
      status: exportReq.status,
      format: exportReq.format,
      file_size: exportReq.file_size,
      checksum: exportReq.checksum,
      generated_at: exportReq.generated_at,
      expires_at: exportReq.expires_at,
      error_message: exportReq.error_message,
    };
  }

  static async getExportList(userId: string, page = 1, limit = 10) {
    const [exports, total] = await exportRepo().findAndCount({
      where: { user_id: userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      exports: exports.map(e => ({
        export_id: e.export_id,
        status: e.status,
        format: e.format,
        generated_at: e.generated_at,
        expires_at: e.expires_at,
      })),
      total,
      page,
      limit,
    };
  }

  static async downloadExport(userId: string, exportId: string): Promise<{ filePath: string; fileName: string }> {
    const exportReq = await exportRepo().findOne({
      where: { export_id: exportId, user_id: userId },
    });
    if (!exportReq) throw new Error('Export request not found');
    if (exportReq.status !== 'completed') throw new Error('Export not ready');
    if (!exportReq.file_path || !fs.existsSync(exportReq.file_path)) throw new Error('Export file not found');
    if (new Date() > exportReq.expires_at) throw new Error('Export expired');

    return {
      filePath: exportReq.file_path,
      fileName: `${exportId}_export.json`,
    };
  }
}
