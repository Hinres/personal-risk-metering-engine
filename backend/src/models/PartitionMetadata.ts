/**
 * [PRME-INFRA-002] 审计与合规 - 分区元数据
 * 文件: PartitionMetadata.ts
 * 需求描述: 跟踪分区表元数据（应用层分区管理）
 * 最后更新: 2026-06-19
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';

export type PartitionTableType = 'audit_logs' | 'monitor_snapshots';

@Entity('partition_metadata')
export class PartitionMetadata {
  @PrimaryGeneratedColumn('uuid')
  metadata_id!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  table_type!: PartitionTableType;     // audit_logs / monitor_snapshots

  @Column({ type: 'varchar', length: 20 })
  partition_name!: string;             // e.g. "2026_06"

  @Column({ type: 'date' })
  partition_start!: Date;              // 分区起始日期

  @Column({ type: 'date' })
  partition_end!: Date;                // 分区结束日期（不含）

  @Column({ type: 'bigint', default: 0 })
  record_count!: number;               // 预估记录数（由维护任务更新）

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'archived' | 'dropped';  // active / archived / dropped

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  archived_at!: Date | null;
}
