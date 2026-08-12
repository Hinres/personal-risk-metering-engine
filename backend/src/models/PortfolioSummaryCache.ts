/**
 * [PRME-INFRA-003] 性能与缓存 — SQLite 缓存表
 * 文件: PortfolioSummaryCache.ts
 * 需求描述: 替代 Redis 组合摘要缓存
 * 关联: arc v1.2 架构设计 §3.2.2 L2 缓存
 * 最后更新: 2026-06-14
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('portfolio_summary_cache')
@Index(['expires_at'])
export class PortfolioSummaryCache {
  @PrimaryColumn({ type: 'uuid' })
  portfolio_id!: string;

  @Column({ type: 'text' })
  summary_json!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  total_market_value!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  var_95_1d!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  max_drawdown!: number | null;

  @Column({ type: 'integer' })
  updated_at!: number; // Unix timestamp

  @Column({ type: 'integer' })
  expires_at!: number; // Unix timestamp

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
