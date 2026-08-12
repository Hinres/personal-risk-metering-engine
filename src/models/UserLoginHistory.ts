/**
 * [PRME-TS-002] 用户登录历史
 * 文件: UserLoginHistory.ts
 * 需求描述: 等保二级-身份鉴别控制点优化：记录每次登录详情，支持异常检测
 * 最后更新: 2026-07-07
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_login_history')
export class UserLoginHistory {
  @PrimaryGeneratedColumn('uuid')
  login_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  login_type!: string; // 'password' | 'wechat' | 'refresh_token'

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_fingerprint!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  location!: string | null; // 城市/地区，如 "Shanghai, CN"

  @Column({ type: 'boolean', default: false })
  is_successful!: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  failure_reason!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  session_token_jti!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
