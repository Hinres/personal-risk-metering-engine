/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: RiskEvent.ts
 * 需求描述: 存储外部风险事件
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { RiskEventSource } from './RiskEventSource';

@Entity('risk_events')
export class RiskEvent {
  @PrimaryGeneratedColumn('uuid')
  event_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  source_id!: string;

  @ManyToOne(() => RiskEventSource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: RiskEventSource;

  @Column({ type: 'varchar', length: 30 })
  source_type!: 'announcement' | 'industry_policy' | 'macro_data';

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_id!: string | null;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 20 })
  level!: 'critical' | 'high' | 'medium' | 'low';

  @Column({ type: 'text', nullable: true })
  symbols!: string | null;

  @Column({ type: 'text', nullable: true })
  sectors!: string | null;

  @Column({ type: 'text', nullable: true })
  macro_tags!: string | null;

  @Column({ type: 'datetime' })
  occurred_at!: Date;

  @CreateDateColumn({ type: 'datetime' })
  fetched_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_processed!: boolean;
}
