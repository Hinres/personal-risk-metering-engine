/**
 * [PRME-TS-002] 用户设置
 * 文件: UserSession.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { JsonColumn, DateTimeColumn } from '../utils/dbTypes';
import { User } from './User';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid') session_id!: string;

  
  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;

  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token!: string | null;

  @JsonColumn({ nullable: true })
  device_info!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @DateTimeColumn()
  expires_at!: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @DateTimeColumn({ default: () => 'CURRENT_TIMESTAMP' })
  last_active_at!: Date;
}
