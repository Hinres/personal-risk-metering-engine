/**
 * [PRME-INFRA-002] 审计日志完整性校验服务
 * 文件: auditLogIntegrity.service.ts
 * 需求描述: 等保二级-安全审计控制点优化：审计日志防篡改
 * 最后更新: 2026-07-07
 */
import crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { AuditLogIntegrity } from '../models/AuditLogIntegrity';
import logger from '../utils/logger';

const integrityRepo = () => AppDataSource.getRepository(AuditLogIntegrity);

export class AuditLogIntegrityService {
  /**
   * 计算审计日志的 SHA-256 哈希
   */
  static computeLogHash(logData: {
    log_id: string;
    user_id: string | null;
    operation_type: string;
    resource_type: string;
    resource_id: string | null;
    details: Record<string, any>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }): string {
    const data = JSON.stringify({
      log_id: logData.log_id,
      user_id: logData.user_id,
      operation_type: logData.operation_type,
      resource_type: logData.resource_type,
      resource_id: logData.resource_id,
      details: logData.details,
      ip_address: logData.ip_address,
      user_agent: logData.user_agent,
      created_at: logData.created_at.toISOString(),
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 记录新的审计日志哈希，形成哈希链
   */
  static async recordIntegrity(logId: string, logData: {
    user_id: string | null;
    operation_type: string;
    resource_type: string;
    resource_id: string | null;
    details: Record<string, any>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }): Promise<void> {
    try {
      // 获取上一条记录的哈希
      // PRME-UAT-20260721: TypeORM 0.3.x 要求 findOne 必须提供 where 条件
      const lastRecord = await integrityRepo().findOne({
        where: {},
        order: { chain_index: 'DESC' },
      });

      const previousHash = lastRecord ? lastRecord.log_hash : '0'.repeat(64);
      const chainIndex = lastRecord ? lastRecord.chain_index + 1 : 0;
      const chainRoot = lastRecord ? lastRecord.chain_root : '0'.repeat(64);

      const logHash = this.computeLogHash({
        log_id: logId,
        ...logData,
      });

      // 第一个记录：root 为自身 hash
      const finalRoot = chainIndex === 0 ? logHash : chainRoot;

      const record = integrityRepo().create({
        log_id: logId,
        log_hash: logHash,
        previous_hash: previousHash,
        chain_root: finalRoot,
        chain_index: chainIndex,
      });

      await integrityRepo().save(record);

      logger.debug('Audit log integrity recorded', { logId, chainIndex, hash: logHash.substring(0, 16) + '...' });
    } catch (e: any) {
      logger.error('Failed to record audit log integrity', { error: e.message, logId });
      // 不阻塞主流程
    }
  }

  /**
   * 验证哈希链完整性
   * 返回所有断裂的日志 ID
   */
  static async verifyChain(): Promise<{
    valid: boolean;
    total: number;
    broken: Array<{ log_id: string; chain_index: number; reason: string }>;
  }> {
    const records = await integrityRepo().find({
      order: { chain_index: 'ASC' },
    });

    if (records.length === 0) {
      return { valid: true, total: 0, broken: [] };
    }

    const broken: Array<{ log_id: string; chain_index: number; reason: string }> = [];

    // 验证 root
    if (records[0].chain_index !== 0) {
      broken.push({
        log_id: records[0].log_id,
        chain_index: records[0].chain_index,
        reason: 'Chain root missing (first record chain_index != 0)',
      });
    }

    // 验证链连续性
    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      const previous = records[i - 1];

      if (current.previous_hash !== previous.log_hash) {
        broken.push({
          log_id: current.log_id,
          chain_index: current.chain_index,
          reason: `Hash chain broken: expected previous_hash=${previous.log_hash.substring(0, 16)}..., got ${current.previous_hash.substring(0, 16)}...`,
        });
      }

      if (current.chain_index !== previous.chain_index + 1) {
        broken.push({
          log_id: current.log_id,
          chain_index: current.chain_index,
          reason: `Chain index discontinuity: expected ${previous.chain_index + 1}, got ${current.chain_index}`,
        });
      }
    }

    return {
      valid: broken.length === 0,
      total: records.length,
      broken,
    };
  }

  /**
   * 验证单条日志的完整性
   */
  static async verifyLog(logId: string, logData: {
    user_id: string | null;
    operation_type: string;
    resource_type: string;
    resource_id: string | null;
    details: Record<string, any>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }): Promise<{ valid: boolean; expectedHash: string; actualHash: string }> {
    const record = await integrityRepo().findOne({ where: { log_id: logId } });
    if (!record) {
      return { valid: false, expectedHash: '', actualHash: 'NOT_FOUND' };
    }

    const expectedHash = this.computeLogHash({ log_id: logId, ...logData });
    return {
      valid: record.log_hash === expectedHash,
      expectedHash,
      actualHash: record.log_hash,
    };
  }

  /**
   * 获取完整性校验统计
   */
  static async getStats(): Promise<{
    total_records: number;
    chain_valid: boolean;
    last_verified_at: string;
    broken_count: number;
  }> {
    const result = await this.verifyChain();
    return {
      total_records: result.total,
      chain_valid: result.valid,
      last_verified_at: new Date().toISOString(),
      broken_count: result.broken.length,
    };
  }
}

export default AuditLogIntegrityService;
