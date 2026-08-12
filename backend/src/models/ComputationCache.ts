/**
 * [PRME-INFRA-003] 性能与缓存 — SQLite 缓存表
 * 文件: ComputationCache.ts
 * 需求描述: 替代 Redis 计算结果缓存
 * 关联: arc v1.2 架构设计 §3.2.2 L2 缓存
 * 最后更新: 2026-06-14
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('computation_cache')
@Index(['computation_type', 'param_hash'])
@Index(['expires_at'])
export class ComputationCache {
  @PrimaryColumn({ type: 'text' })
  cache_key!: string; // md5(参数JSON)

  @Column({ type: 'text' })
  result_json!: string;

  @Column({ type: 'varchar', length: 50 })
  computation_type!: string; // var / stress / optimize / risk-summary

  @Column({ type: 'text' })
  param_hash!: string;

  @Column({ type: 'integer' })
  computed_at!: number; // Unix timestamp

  @Column({ type: 'integer' })
  expires_at!: number; // Unix timestamp

  @Column({ type: 'integer', default: 0 })
  hit_count!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
