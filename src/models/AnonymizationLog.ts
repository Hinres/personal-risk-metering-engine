/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: AnonymizationLog.ts
 * 需求描述: 审计与合规功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { DateTimeColumn } from '../utils/dbTypes';

@Entity('anonymization_logs')
export class AnonymizationLog {
  @PrimaryGeneratedColumn('uuid')
  log_id!: string;

  @Column({ type: 'varchar', length: 50 })
  table_name!: string;

  @Column({ type: 'integer' })
  records_processed!: number;

  @Column({ type: 'varchar', length: 20 })
  anonymization_type!: string;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @DateTimeColumn()
  started_at!: Date;

  @DateTimeColumn({ nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
