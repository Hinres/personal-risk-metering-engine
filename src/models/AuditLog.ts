/**
 * [PRME-INFRA-002] 审计与合规
 * 文件: AuditLog.ts
 * 需求描述: 审计日志（设计文档命名对齐，替代 OperationLog）
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { User } from './User';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') log_id!: string;

  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ type: 'varchar', length: 50 })
  operation_type!: string;

  @Column({ type: 'varchar', length: 50 })
  resource_type!: string;

  @Column({ type: 'uuid', nullable: true })
  resource_id!: string | null;

  @Column({ type: 'simple-json', default: '{}' })
  details!: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
