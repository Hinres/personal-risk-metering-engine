/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: audit.service.ts
 * 需求描述: 审计与合规功能实现
 * 最后更新: 2026-07-02
 */
import { AppDataSource } from '../config/database';
import { AuditLog } from '../models/AuditLog';
import { PartitionService } from './partition.service';
import { AuditLogIntegrityService } from './auditLogIntegrity.service';
import logger from '../utils/logger';

const logRepo = () => AppDataSource.getRepository(AuditLog);

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Record an operation log (writes to main table + partitioned table)
   */
  static async log(
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'QUERY' | 'CALCULATE' | 'GENERATE' | 'OPTIMIZE',
    resourceType: string,
    resourceId: string | null,
    details: Record<string, any> = {},
    ctx: AuditContext = {}
  ) {
    try {
      const logData = {
        user_id: ctx.userId || null,
        operation_type: operationType,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: ctx.ipAddress || null,
        user_agent: ctx.userAgent || null,
      };

      // 1. Write to main audit_logs table (backward compatibility)
      const log = logRepo().create(logData);
      await logRepo().save(log);

      // 2. Record integrity hash chain
      await AuditLogIntegrityService.recordIntegrity(log.log_id, {
        ...logData,
        created_at: new Date(),
      });

      // 3. Write to partitioned table (P1-2: application-level partitioning)
      await PartitionService.insert('audit_logs', {
        user_id: logData.user_id,
        operation_type: logData.operation_type,
        resource_type: logData.resource_type,
        resource_id: logData.resource_id,
        details: JSON.stringify(logData.details),
        ip_address: logData.ip_address,
        user_agent: logData.user_agent,
      });
    } catch (err: any) {
      logger.error('Audit log failed', { error: err.message, operationType, resourceType });
      // Never throw — audit failure should not break business logic
    }
  }

  /**
   * Log entity creation
   */
  static async logCreate(
    resourceType: string,
    resourceId: string,
    newData: Record<string, any>,
    ctx: AuditContext = {}
  ) {
    return this.log('CREATE', resourceType, resourceId, { new: newData }, ctx);
  }

  /**
   * Log entity update
   */
  static async logUpdate(
    resourceType: string,
    resourceId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    ctx: AuditContext = {}
  ) {
    return this.log('UPDATE', resourceType, resourceId, { old: oldData, new: newData }, ctx);
  }

  /**
   * Log entity deletion
   */
  static async logDelete(
    resourceType: string,
    resourceId: string,
    oldData: Record<string, any>,
    ctx: AuditContext = {}
  ) {
    return this.log('DELETE', resourceType, resourceId, { old: oldData }, ctx);
  }

  /**
   * Query audit logs with pagination and filters
   */
  static async queryLogs(params: {
    page?: number;
    limit?: number;
    user_id?: string;
    operation_type?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const queryBuilder = logRepo().createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.user_id) {
      queryBuilder.andWhere('log.user_id = :user_id', { user_id: params.user_id });
    }
    if (params.operation_type) {
      queryBuilder.andWhere('log.operation_type = :operation_type', { operation_type: params.operation_type });
    }
    if (params.resource_type) {
      queryBuilder.andWhere('log.resource_type = :resource_type', { resource_type: params.resource_type });
    }
    if (params.start_date) {
      queryBuilder.andWhere('log.created_at >= :start_date', { start_date: params.start_date });
    }
    if (params.end_date) {
      queryBuilder.andWhere('log.created_at <= :end_date', { end_date: params.end_date });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();
    return { logs, total, page, limit };
  }
}
