/**
 * [PRME-INFRA-002] 审计日志完整性校验 — 哈希链防篡改
 * 文件: AuditLogIntegrity.ts
 * 需求描述: 等保二级-安全审计控制点优化：审计日志防篡改
 * 最后更新: 2026-07-07
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log_integrity')
export class AuditLogIntegrity {
  @PrimaryGeneratedColumn('uuid')
  integrity_id!: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  log_id!: string;

  /** 当前日志哈希 (SHA-256) */
  @Column({ type: 'varchar', length: 64 })
  log_hash!: string;

  /** 上一条日志的哈希 (形成哈希链) */
  @Column({ type: 'varchar', length: 64 })
  previous_hash!: string;

  /** 哈希链根 (第一个记录为自身哈希) */
  @Column({ type: 'varchar', length: 64 })
  chain_root!: string;

  /** 链序号 */
  @Column({ type: 'integer' })
  chain_index!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
