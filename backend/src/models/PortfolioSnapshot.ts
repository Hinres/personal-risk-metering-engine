/**
 * [PRME-PA-001] 组合结构分析
 * 文件: PortfolioSnapshot.ts
 * 需求描述: 组合结构分析功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
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

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  total_return!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  annual_return!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  volatility!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  sharpe_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  sortino_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  max_drawdown!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  calmar_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  treynor_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  beta!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  risk_free_rate!: number | null;

  @Column({ type: 'simple-json', nullable: true })
  asset_allocation!: Record<string, any> | null;

  @Column({ type: 'simple-json', nullable: true })
  sector_allocation!: Record<string, any> | null;

  @Column({ type: 'simple-json', nullable: true })
  holdings_snapshot!: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
