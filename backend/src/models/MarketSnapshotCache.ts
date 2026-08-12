/**
 * [PRME-INFRA-003] 性能与缓存 — SQLite 缓存表
 * 文件: MarketSnapshotCache.ts
 * 需求描述: 替代 Redis 实时市场数据快照缓存
 * 关联: arc v1.2 架构设计 §3.2.2 L2 缓存
 * 最后更新: 2026-06-14
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('market_snapshot_cache')
@Index(['expires_at'])
export class MarketSnapshotCache {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  symbol!: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  snapshot_type!: string; // price / index / indicator

  @Column({ type: 'text' })
  data_json!: string;

  @Column({ type: 'integer' })
  fetched_at!: number; // Unix timestamp

  @Column({ type: 'integer' })
  expires_at!: number; // Unix timestamp

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
