/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: DataExportRequest.ts
 * 需求描述: 审计与合规功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { JsonColumn, DateTimeColumn } from '../utils/dbTypes';
import { User } from './User';

@Entity('data_export_requests')
export class DataExportRequest {
  @PrimaryGeneratedColumn('uuid')
  export_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  format!: string;

  @JsonColumn({ nullable: true })
  include_tables!: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  file_path!: string | null;

  @Column({ type: 'bigint', nullable: true })
  file_size!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @DateTimeColumn()
  expires_at!: Date;

  @DateTimeColumn({ nullable: true })
  generated_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
