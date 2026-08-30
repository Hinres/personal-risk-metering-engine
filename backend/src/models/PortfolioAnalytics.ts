/**
 * [PRME-v1.3-PA-002] 卡玛/特雷诺比率
 * 文件: PortfolioAnalytics.ts
 * 需求描述: 组合风险收益分析指标快照
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index, Unique
} from 'typeorm';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('portfolio_analytics')
@Unique(['portfolio_id', 'analysis_date'])
export class PortfolioAnalytics {
  @PrimaryGeneratedColumn('uuid')
  analytics_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'date' })
  analysis_date!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  total_value!: number | null;

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

  @Column({ type: 'text', nullable: true })
  metrics!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
