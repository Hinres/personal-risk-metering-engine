/**
 * [PRME-TS-002] 用户设置
 * 文件: UserConsent.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { DateTimeColumn } from '../utils/dbTypes';
import { User } from './User';

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  consent_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  consent_type!: string;

  @Column({ type: 'varchar', length: 20 })
  consent_version!: string;

  @Column({ type: 'varchar', length: 64 })
  consent_text_hash!: string;

  @CreateDateColumn({ type: 'datetime' })
  granted_at!: Date;

  @Column({ type: 'varchar', length: 20 })
  granted_via!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string | null;

  @DateTimeColumn({ nullable: true })
  revoked_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  revoked_reason!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
