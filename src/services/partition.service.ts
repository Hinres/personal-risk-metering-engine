/**
 * [PRME-INFRA-002] 分区表服务 - 应用层分区管理
 * 文件: partition.service.ts
 * 需求描述: SQLite 不支持原生分区表，通过应用层实现按月分表
 * 最后更新: 2026-06-19
 */

import { AppDataSource } from '../config/database';
import { PartitionMetadata, PartitionTableType } from '../models/PartitionMetadata';
import logger from '../utils/logger';

const PARTITION_RETENTION_MONTHS: Record<PartitionTableType, number> = {
  audit_logs: 36,          // 3 年
  monitor_snapshots: 3,    // 3 个月（高频数据，每30秒一条）
};

export class PartitionService {
  private static metadataRepo = () => AppDataSource.getRepository(PartitionMetadata);

  /**
   * 获取分区表名
   */
  static getPartitionTableName(tableType: PartitionTableType, partitionName: string): string {
    return `${tableType}_${partitionName}`;
  }

  /**
   * 根据日期确定分区名 (YYYY_MM)
   */
  static getPartitionName(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}_${month}`;
  }

  /**
   * 获取分区起始/结束日期
   */
  static getPartitionRange(partitionName: string): { start: Date; end: Date } {
    const [year, month] = partitionName.split('_').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { start, end };
  }

  /**
   * 创建分区表（如果不存在）
   */
  static async ensurePartition(
    tableType: PartitionTableType,
    partitionName?: string
  ): Promise<string> {
    const pName = partitionName || this.getPartitionName();
    const tableName = this.getPartitionTableName(tableType, pName);

    // 检查元数据
    let metadata = await this.metadataRepo().findOne({
      where: { table_type: tableType, partition_name: pName },
    });

    if (metadata) {
      return tableName;
    }

    // 创建分区表
    const { start, end } = this.getPartitionRange(pName);

    if (tableType === 'audit_logs') {
      await this.createAuditLogPartition(tableName, pName, start, end);
    } else if (tableType === 'monitor_snapshots') {
      await this.createMonitorSnapshotPartition(tableName, pName, start, end);
    }

    // 记录元数据
    metadata = this.metadataRepo().create({
      table_type: tableType,
      partition_name: pName,
      partition_start: start,
      partition_end: end,
      status: 'active',
    });
    await this.metadataRepo().save(metadata);

    logger.info(`[Partition] Created partition table: ${tableName}`);
    return tableName;
  }

  /**
   * 创建 audit_log 分区表
   */
  private static async createAuditLogPartition(
    tableName: string,
    partitionName: string,
    start: Date,
    end: Date
  ): Promise<void> {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        log_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT,
        operation_type VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id TEXT,
        details TEXT DEFAULT '{}',
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (created_at >= '${start.toISOString().split('T')[0]}' AND created_at < '${end.toISOString().split('T')[0]}')
      )
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_user ON ${tableName}(user_id)
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at)
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_resource ON ${tableName}(resource_type, resource_id)
    `);
  }

  /**
   * 创建 monitor_snapshot 分区表
   */
  private static async createMonitorSnapshotPartition(
    tableName: string,
    partitionName: string,
    start: Date,
    end: Date
  ): Promise<void> {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        snapshot_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        portfolio_id TEXT NOT NULL,
        monitor_type VARCHAR(50),
        metric_value DECIMAL(18, 6),
        threshold_value DECIMAL(18, 6),
        operator VARCHAR(10),
        holdings_risk TEXT,
        extra_metrics TEXT,
        snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (snapshot_at >= '${start.toISOString().split('T')[0]}' AND snapshot_at < '${end.toISOString().split('T')[0]}')
      )
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_portfolio ON ${tableName}(portfolio_id)
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_snapshot ON ${tableName}(snapshot_at)
    `);
  }

  /**
   * 插入数据到正确的分区
   */
  static async insert<T extends Record<string, any>>(
    tableType: PartitionTableType,
    data: T,
    timestampField: string = 'created_at'
  ): Promise<void> {
    const ts = data[timestampField] || new Date();
    const partitionName = this.getPartitionName(new Date(ts));
    const tableName = await this.ensurePartition(tableType, partitionName);

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    await AppDataSource.query(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
      values
    );
  }

  /**
   * 跨分区查询（返回 UNION ALL 查询 SQL）
   */
  static async queryPartitions(
    tableType: PartitionTableType,
    options: {
      startDate?: Date;
      endDate?: Date;
      where?: string;
      params?: any[];
      orderBy?: string;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const { startDate, endDate, where, params = [], orderBy, limit } = options;

    // 获取所有 active 分区
    let qb = this.metadataRepo().createQueryBuilder('pm')
      .where('pm.table_type = :tableType', { tableType })
      .andWhere('pm.status = :status', { status: 'active' });

    if (startDate) {
      qb = qb.andWhere('pm.partition_end > :startDate', { startDate });
    }
    if (endDate) {
      qb = qb.andWhere('pm.partition_start <= :endDate', { endDate });
    }

    const partitions = await qb.getMany();

    if (partitions.length === 0) {
      return [];
    }

    // 构建 UNION ALL 查询
    const unionQueries = partitions.map(p => {
      const tableName = this.getPartitionTableName(tableType, p.partition_name);
      let sql = `SELECT * FROM ${tableName}`;
      if (where) {
        sql += ` WHERE ${where}`;
      }
      return sql;
    });

    let finalSql = unionQueries.join(' UNION ALL ');
    if (orderBy) {
      finalSql += ` ORDER BY ${orderBy}`;
    }
    if (limit) {
      finalSql += ` LIMIT ${limit}`;
    }

    return AppDataSource.query(finalSql, params);
  }

  /**
   * 获取分区列表
   */
  static async listPartitions(
    tableType: PartitionTableType,
    status?: 'active' | 'archived' | 'dropped'
  ): Promise<PartitionMetadata[]> {
    const where: any = { table_type: tableType };
    if (status) {
      where.status = status;
    }
    return this.metadataRepo().find({ where, order: { partition_start: 'DESC' } });
  }

  /**
   * 分区维护：创建新分区、归档/删除过期分区
   */
  static async maintainPartitions(): Promise<{
    created: string[];
    archived: string[];
    dropped: string[];
  }> {
    const result = { created: [] as string[], archived: [] as string[], dropped: [] as string[] };

    const types: PartitionTableType[] = ['audit_logs', 'monitor_snapshots'];

    for (const tableType of types) {
      // 1. 确保当前月和下月分区存在
      const now = new Date();
      const currentMonth = this.getPartitionName(now);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonth = this.getPartitionName(nextMonthDate);

      for (const pName of [currentMonth, nextMonth]) {
        const tableName = await this.ensurePartition(tableType, pName);
        if (!result.created.includes(tableName)) {
          result.created.push(tableName);
        }
      }

      // 2. 归档/删除过期分区
      const retentionMonths = PARTITION_RETENTION_MONTHS[tableType];
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - retentionMonths, 1);

      const oldPartitions = await this.metadataRepo().find({
        where: {
          table_type: tableType,
          partition_end: cutoffDate,
          status: 'active',
        },
      });

      for (const partition of oldPartitions) {
        const tableName = this.getPartitionTableName(tableType, partition.partition_name);

        if (tableType === 'audit_logs') {
          // 审计日志：归档后保留（移到 archive 表）
          const archiveTableName = `${tableName}_archive`;
          await AppDataSource.query(
            `CREATE TABLE IF NOT EXISTS ${archiveTableName} AS SELECT * FROM ${tableName} WHERE 1=0`
          );
          await AppDataSource.query(
            `INSERT INTO ${archiveTableName} SELECT * FROM ${tableName}`
          );
          partition.status = 'archived';
          partition.archived_at = new Date();
          await this.metadataRepo().save(partition);
          result.archived.push(tableName);
          logger.info(`[Partition] Archived ${tableName} -> ${archiveTableName}`);
        } else {
          // 监控快照：直接删除
          await AppDataSource.query(`DROP TABLE IF EXISTS ${tableName}`);
          partition.status = 'dropped';
          await this.metadataRepo().save(partition);
          result.dropped.push(tableName);
          logger.info(`[Partition] Dropped ${tableName}`);
        }
      }
    }

    return result;
  }

  /**
   * 统计活跃分区记录数
   */
  static async countByPartition(tableType: PartitionTableType): Promise<Record<string, number>> {
    const partitions = await this.listPartitions(tableType, 'active');
    const result: Record<string, number> = {};

    for (const p of partitions) {
      const tableName = this.getPartitionTableName(tableType, p.partition_name);
      try {
        const rows = await AppDataSource.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
        result[p.partition_name] = rows[0]?.cnt || 0;
      } catch (e) {
        result[p.partition_name] = -1; // 表不存在
      }
    }

    return result;
  }
}
