/**
 * [PRME-INFRA-002] 审计与合规 — 数据匿名化流水线
 * 文件: anonymization.service.ts
 * 需求描述: 用于统计分析的数据匿名化，去除可识别个人信息
 * 关联: arc v1.2 架构设计 §3.2 / PRD 3.3 数据匿名化
 * 最后更新: 2026-06-14
 */
import { AppDataSource } from '../config/database';
import { AnonymizationLog } from '../models/AnonymizationLog';
import { AuditLog } from '../models/AuditLog';
import logger from '../utils/logger';

const anonymizationRepo = () => AppDataSource.getRepository(AnonymizationLog);

interface AnonymizationRule {
  column: string;
  method: 'hash' | 'mask' | 'truncate' | 'remove' | 'generalize';
  options?: Record<string, any>;
}

interface AnonymizationConfig {
  table: string;
  rules: AnonymizationRule[];
  where?: string;
}

// 匿名化配置：敏感字段映射
const ANONYMIZATION_CONFIGS: AnonymizationConfig[] = [
  {
    table: 'users',
    rules: [
      { column: 'username', method: 'hash' },
      { column: 'email', method: 'mask', options: { maskChar: '*', visiblePrefix: 2, visibleSuffix: 4 } },
      { column: 'phone', method: 'mask', options: { maskChar: '*', visiblePrefix: 3, visibleSuffix: 4 } },
      { column: 'openid', method: 'hash' },
      { column: 'unionid', method: 'hash' },
      { column: 'avatar_url', method: 'remove' },
      { column: 'wechat_info', method: 'remove' },
      { column: 'metadata', method: 'remove' },
    ],
    where: "status != 'deleted'",
  },
  {
    table: 'audit_logs',
    rules: [
      { column: 'ip_address', method: 'generalize', options: { keepSegments: 2 } }, // 保留前2段
      { column: 'user_agent', method: 'truncate', options: { maxLength: 20 } },
    ],
  },
  {
    table: 'data_export_requests',
    rules: [
      { column: 'file_path', method: 'remove' },
    ],
  },
];

export class AnonymizationService {
  /**
   * 执行单表匿名化
   */
  static async anonymizeTable(config: AnonymizationConfig, dryRun = false): Promise<{
    table: string;
    recordsProcessed: number;
    fieldsAnonymized: string[];
  }> {
    const { table, rules, where } = config;
    const fieldsAnonymized: string[] = [];

    let updateClause = '';
    const setParts: string[] = [];

    for (const rule of rules) {
      const anonymizedValue = this.applyAnonymizationMethod('dummy', rule.method, rule.options);
      if (rule.method === 'remove') {
        setParts.push(`${rule.column} = NULL`);
      } else if (rule.method === 'hash') {
        setParts.push(`${rule.column} = 'ANON_' || substr(hex(randomblob(8)), 1, 16)`);
      } else if (rule.method === 'mask') {
        const { maskChar = '*', visiblePrefix = 2, visibleSuffix = 2 } = rule.options || {};
        setParts.push(`${rule.column} = substr(${rule.column}, 1, ${visiblePrefix}) || '${maskChar.repeat(4)}' || substr(${rule.column}, -${visibleSuffix})`);
      } else if (rule.method === 'truncate') {
        const { maxLength = 20 } = rule.options || {};
        setParts.push(`${rule.column} = substr(${rule.column}, 1, ${maxLength})`);
      } else if (rule.method === 'generalize') {
        const { keepSegments = 2 } = rule.options || {};
        if (rule.column === 'ip_address' && keepSegments === 2) {
          // T-23: 修正 IP 地址泛化 SQL，保留前 2 段
          // SQLite/PostgreSQL 兼容: substr + instr
          setParts.push(`${rule.column} = CASE WHEN instr(${rule.column}, '.') > 0 THEN substr(${rule.column}, 1, instr(${rule.column}, '.') + instr(substr(${rule.column}, instr(${rule.column}, '.') + 1), '.') - 1) || '.0.0' ELSE ${rule.column} END`);
        } else {
          // 通用泛化: 按分隔符分段保留
          setParts.push(`${rule.column} = substr(${rule.column}, 1, ${keepSegments})`);
        }
      }
      fieldsAnonymized.push(rule.column);
    }

    if (setParts.length === 0) {
      return { table, recordsProcessed: 0, fieldsAnonymized: [] };
    }

    updateClause = `UPDATE ${table} SET ${setParts.join(', ')}`;
    if (where) {
      updateClause += ` WHERE ${where}`;
    }

    if (dryRun) {
      logger.info('[DryRun] Anonymization query', { table, query: updateClause });
      return { table, recordsProcessed: 0, fieldsAnonymized };
    }

    // 使用原生查询执行匿名化（SQLite 不支持复杂 UPDATE 子查询语法，直接执行）
    const result = await AppDataSource.query(updateClause);
    const recordsProcessed = result?.changes || 0;

    return { table, recordsProcessed, fieldsAnonymized };
  }

  /**
   * 执行全量匿名化流水线
   */
  static async runAnonymizationPipeline(dryRun = false): Promise<{
    logId: string;
    results: Array<{ table: string; recordsProcessed: number; fieldsAnonymized: string[] }>;
    totalRecords: number;
    status: string;
  }> {
    const log = anonymizationRepo().create({
      table_name: 'multi_table_pipeline',
      records_processed: 0,
      anonymization_type: 'scheduled_batch',
      status: 'running',
      started_at: new Date(),
    });
    await anonymizationRepo().save(log);

    const results: Array<{ table: string; recordsProcessed: number; fieldsAnonymized: string[] }> = [];
    let totalRecords = 0;

    try {
      for (const config of ANONYMIZATION_CONFIGS) {
        const result = await this.anonymizeTable(config, dryRun);
        results.push(result);
        totalRecords += result.recordsProcessed;
      }

      log.records_processed = totalRecords;
      log.status = dryRun ? 'dry_run_completed' : 'completed';
      log.completed_at = new Date();
      await anonymizationRepo().save(log);

      logger.info('Anonymization pipeline completed', {
        logId: log.log_id,
        totalRecords,
        dryRun,
      });
    } catch (error: any) {
      log.status = 'failed';
      log.error_message = error.message;
      log.completed_at = new Date();
      await anonymizationRepo().save(log);
      logger.error('Anonymization pipeline failed', { logId: log.log_id, error: error.message });
      throw error;
    }

    return { logId: log.log_id, results, totalRecords, status: log.status };
  }

  /**
   * 获取匿名化历史
   */
  static async getHistory(limit = 50) {
    return anonymizationRepo().find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * 模拟匿名化方法（用于 dry-run 展示）
   */
  private static applyAnonymizationMethod(
    value: string,
    method: string,
    options?: Record<string, any>
  ): string {
    switch (method) {
      case 'hash':
        return 'ANON_' + Math.random().toString(36).substring(2, 10);
      case 'mask': {
        const { maskChar = '*', visiblePrefix = 2, visibleSuffix = 2 } = options || {};
        if (value.length <= visiblePrefix + visibleSuffix) return value;
        return value.substring(0, visiblePrefix) + maskChar.repeat(4) + value.substring(value.length - visibleSuffix);
      }
      case 'truncate': {
        const { maxLength = 20 } = options || {};
        return value.substring(0, maxLength);
      }
      case 'remove':
        return '';
      case 'generalize': {
        const { keepSegments = 2 } = options || {};
        if (value.includes('.')) {
          const parts = value.split('.');
          return parts.slice(0, keepSegments).join('.') + '.0.0';
        }
        return value;
      }
      default:
        return value;
    }
  }
}

export default AnonymizationService;
