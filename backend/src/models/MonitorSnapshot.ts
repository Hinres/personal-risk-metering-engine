/**
 * [PRME-RM-001] 实时监控 - 监控快照实体
 * 文件: MonitorSnapshot.ts
 * 需求描述: 监控快照数据模型（支持应用层按时间分区）
 * 最后更新: 2026-06-19
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Portfolio } from './Portfolio';

@Entity('monitor_snapshots')
export class MonitorSnapshot {
  @PrimaryGeneratedColumn('uuid')
  snapshot_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'varchar', length: 50, nullable: true })
  monitor_type!: string | null;       // var_threshold / drawdown / concentration / volatility / liquidity

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  metric_value!: number | null;       // 指标当前值

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  threshold_value!: number | null;    // 阈值

  @Column({ type: 'varchar', length: 10, nullable: true })
  operator!: string | null;           // > / < / >= / <= / =

  @Column({ type: 'simple-json', nullable: true })
  holdings_risk!: Record<string, any> | null;  // 持仓风险快照

  @Column({ type: 'simple-json', nullable: true })
  extra_metrics!: Record<string, any> | null;  // 额外指标

  @CreateDateColumn({ type: 'datetime' })
  snapshot_at!: Date;
}
