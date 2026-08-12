/**
 * [PRME-INFRA-001] 认证与授权 — Refresh Token 黑名单
 * 文件: RefreshTokenBlacklist.ts
 * 需求描述: 替代 Redis 黑名单，JWT 无状态化下的登出机制
 * 关联: arc v1.2 架构设计 §3.3.2
 * 最后更新: 2026-06-14
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('refresh_token_blacklist')
@Index(['expires_at'])
export class RefreshTokenBlacklist {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  token_jti!: string; // JWT ID（唯一标识）

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'integer' })
  revoked_at!: number; // Unix timestamp

  @Column({ type: 'integer' })
  expires_at!: number; // Token 原过期时间（用于清理）

  @Column({ type: 'varchar', length: 50, nullable: true })
  reason!: string | null; // logout / password_change / suspicious

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
