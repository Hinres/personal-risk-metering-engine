/**
 * [PRME-PA-001] 组合结构分析
 * 文件: PortfolioSnapshot.ts
 * 需求描述: 组合结构分析功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn('uuid')
  snapshot_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'date' })
  snapshot_date!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  total_market_value!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  total_cost!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  daily_return!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  cumulative_return!: number | null;

  @JsonColumn({ nullable: true })
  holdings_snapshot!: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
