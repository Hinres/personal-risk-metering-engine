/**
 * [PRME-v1.3-PA-002] 完整 Brinson 业绩归因
 * 文件: AttributionResult.ts
 * 需求描述: 存储 Brinson 归因结果
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('attribution_results')
export class AttributionResult {
  @PrimaryGeneratedColumn('uuid')
  attribution_id!: string;

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

  @Column({ type: 'varchar', length: 30 })
  benchmark_type!: string;

  @Column({ type: 'text', nullable: true })
  benchmark_config!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  portfolio_return!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  benchmark_return!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  excess_return!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  allocation_effect!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  selection_effect!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  interaction_effect!: number;

  @Column({ type: 'text' })
  sector_details!: string;

  @Column({ type: 'text' })
  disclaimer!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
