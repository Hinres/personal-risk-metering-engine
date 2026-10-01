/**
 * [PRME-INFRA-001] 认证与授权
 * 文件: AdminApprovalRequest.ts
 * 需求描述: 认证与授权功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

@Entity('admin_approval_requests')
export class AdminApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  request_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  requester_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester!: User;

  @Column({ type: 'uuid', nullable: true })
  approver_id!: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resource_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  resource_id!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  before_value!: Record<string, any> | null;

  @Column({ type: 'simple-json', nullable: true })
  after_value!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  requested_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  rejected_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'text', nullable: true })
  execution_error!: string | null;

  @Column({ type: 'datetime', nullable: true })
  cancelled_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
